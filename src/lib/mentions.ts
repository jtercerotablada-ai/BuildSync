import prisma from "@/lib/prisma";
import { shouldNotify } from "@/lib/notification-prefs";
import { resolveProjectAccess } from "@/lib/project-access";
import { isNonContributorRole } from "@/lib/workspace-roles";

/**
 * Filter a set of MENTIONED recipients down to those who haven't
 * opted out of mention notifications (notifyMentioned). Preserves
 * order and dedupes nothing (callers pass an already-clean list).
 */
async function gateMentionRecipients(recipients: string[]): Promise<string[]> {
  const flags = await Promise.all(
    recipients.map((uid) => shouldNotify(uid, "MENTIONED"))
  );
  return recipients.filter((_, i) => flags[i]);
}

/**
 * Mention helpers shared across the message + reply endpoints.
 *
 * Convention:
 *  - Clients send `mentionUserIds: string[]` alongside the message
 *    content. The server validates each id against the project's
 *    membership before creating MessageMention rows.
 *  - For each new mention we drop a Notification row of type
 *    MENTIONED so the recipient sees it in their inbox.
 *  - Self-mentions are silently filtered (no point pinging
 *    yourself); the row is created so display still works but no
 *    notification is generated.
 */

const MAX_MENTION_CANDIDATES = 50;

/**
 * Validate a list of candidate user ids against the project's audience:
 * everyone who can READ the project under the canonical rule
 * (resolveProjectAccess — owner, members, team members, workspace managers,
 * senior staff, and every contributor when the project is WORKSPACE/PUBLIC).
 * Returns the subset that is actually allowed to be mentioned.
 *
 * Mentions outside this set are dropped on the server — clients
 * shouldn't be able to ping users who can't see the project
 * anyway, because the resulting notification would carry a preview of a
 * message they can't read and link to a page that 404s. The rule used to be
 * a private copy (owner + members + any workspace member on WORKSPACE), which
 * both dropped legitimate readers and admitted non-readers.
 */
export async function resolveAllowedMentionUserIds(
  projectId: string,
  candidateUserIds: string[]
): Promise<string[]> {
  if (candidateUserIds.length === 0) return [];

  // Bounded: each candidate costs an access resolution, and no real message
  // mentions more people than this.
  const unique = Array.from(new Set(candidateUserIds.filter(Boolean))).slice(
    0,
    MAX_MENTION_CANDIDATES
  );
  if (unique.length === 0) return [];

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      teamId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!project) return [];

  const readable = await Promise.all(
    unique.map(async (uid) => (await resolveProjectAccess(project, uid)).ok)
  );
  return unique.filter((_, i) => readable[i]);
}

interface SyncOptions {
  messageId: string;
  projectId: string | null;
  actorUserId: string;
  mentionUserIds: string[];
  // When provided, used as the notification title. Falls back to
  // a sensible default if omitted.
  authorName?: string;
  // Avatar image url of the author. Lets the inbox render the real
  // sender's face instead of the generic company fallback.
  authorImage?: string | null;
  // The first ~140 chars of the message content (for the preview
  // shown in the inbox row).
  contentPreview: string;
  // Optional reply context — when set, we include the rootId in
  // the notification data so the inbox can deep-link to the
  // expanded thread.
  rootMessageId?: string;
}

/**
 * Persist MessageMention rows for a freshly-created message and
 * spawn Notification rows for each mentioned user (excluding the
 * author so people don't get pinged for mentioning themselves).
 *
 * Idempotent: re-running with the same set is a no-op thanks to
 * the @@unique([messageId, userId]) constraint plus skipDuplicates.
 */
export async function persistMentionsForNewMessage(opts: SyncOptions) {
  const { messageId, projectId, actorUserId, mentionUserIds } = opts;
  if (mentionUserIds.length === 0) return;
  if (!projectId) return; // mentions only make sense on project messages for now

  const allowed = await resolveAllowedMentionUserIds(
    projectId,
    mentionUserIds
  );
  if (allowed.length === 0) return;

  await prisma.messageMention.createMany({
    data: allowed.map((userId) => ({ messageId, userId })),
    skipDuplicates: true,
  });

  // Skip the author from notification fan-out — pinging yourself
  // is noise.
  const recipients = await gateMentionRecipients(
    allowed.filter((uid) => uid !== actorUserId)
  );
  if (recipients.length === 0) return;

  const title = `${opts.authorName || "Someone"} mentioned you`;
  const preview = opts.contentPreview.slice(0, 140);
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: "MENTIONED" as const,
      title,
      message: preview,
      data: {
        messageId,
        projectId,
        rootMessageId: opts.rootMessageId ?? messageId,
        authorName: opts.authorName ?? null,
        authorImage: opts.authorImage ?? null,
      },
    })),
  });
}

/**
 * Re-sync mentions on an edit. Strategy: diff the new allowed
 * set against the existing mention rows.
 *  - rows that should still exist → keep
 *  - rows that are no longer mentioned → delete
 *  - new mentions → insert + notify (only the freshly-added ones,
 *    so editing doesn't spam someone who was already mentioned).
 */
export async function syncMentionsForEditedMessage(opts: SyncOptions) {
  const { messageId, projectId, actorUserId, mentionUserIds } = opts;
  if (!projectId) {
    // Workspace-scoped messages aren't supported here yet.
    return;
  }

  const allowed = new Set(
    await resolveAllowedMentionUserIds(projectId, mentionUserIds)
  );

  const existing = await prisma.messageMention.findMany({
    where: { messageId },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((m) => m.userId));

  const toRemove = [...existingSet].filter((uid) => !allowed.has(uid));
  const toAdd = [...allowed].filter((uid) => !existingSet.has(uid));

  if (toRemove.length > 0) {
    await prisma.messageMention.deleteMany({
      where: { messageId, userId: { in: toRemove } },
    });
  }

  if (toAdd.length === 0) return;

  await prisma.messageMention.createMany({
    data: toAdd.map((userId) => ({ messageId, userId })),
    skipDuplicates: true,
  });

  // Only notify the newly-added mentions (not re-mentions that
  // were already there).
  const recipients = await gateMentionRecipients(
    toAdd.filter((uid) => uid !== actorUserId)
  );
  if (recipients.length === 0) return;

  const title = `${opts.authorName || "Someone"} mentioned you`;
  const preview = opts.contentPreview.slice(0, 140);
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: "MENTIONED" as const,
      title,
      message: preview,
      data: {
        messageId,
        projectId,
        rootMessageId: opts.rootMessageId ?? messageId,
        authorName: opts.authorName ?? null,
        authorImage: opts.authorImage ?? null,
      },
    })),
  });
}

// ──────────────────────────────────────────────────────────────────
// Portfolio scope — Message rows tied to portfolioId share the same
// MessageMention table as project messages, so we only need an
// audience resolver. Notification fan-out is intentionally skipped
// for portfolio mentions today (inbox notifs stay project-only).
// ──────────────────────────────────────────────────────────────────

/**
 * Validate candidate user ids against the portfolio's audience: exactly the
 * people who can read it (same rule as decidePortfolioAccess in
 * /api/portfolios/[portfolioId]). Everyone must belong to the portfolio's
 * own workspace; within it, the owner, explicit members and workspace
 * OWNER/ADMIN always qualify, PUBLIC opens it to every member, and
 * WORKSPACE to every contributor (not GUEST/CLIENT).
 */
export async function resolveAllowedPortfolioMentionUserIds(
  portfolioId: string,
  candidateUserIds: string[]
): Promise<string[]> {
  if (candidateUserIds.length === 0) return [];
  const unique = Array.from(new Set(candidateUserIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    select: {
      ownerId: true,
      privacy: true,
      workspaceId: true,
      members: { select: { userId: true } },
    },
  });
  if (!portfolio) return [];

  const explicit = new Set<string>();
  if (portfolio.ownerId) explicit.add(portfolio.ownerId);
  for (const m of portfolio.members) explicit.add(m.userId);

  // A surviving owner/member row does not outlive the workspace seat: an
  // offboarded user cannot read the portfolio, so they cannot be mentioned.
  const wsMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: portfolio.workspaceId,
      userId: { in: unique },
    },
    select: { userId: true, role: true },
  });

  const allowed = new Set<string>();
  for (const wm of wsMembers) {
    const isManager = wm.role === "OWNER" || wm.role === "ADMIN";
    if (
      explicit.has(wm.userId) ||
      isManager ||
      portfolio.privacy === "PUBLIC" ||
      (portfolio.privacy === "WORKSPACE" && !isNonContributorRole(wm.role))
    ) {
      allowed.add(wm.userId);
    }
  }

  return unique.filter((uid) => allowed.has(uid));
}

// ──────────────────────────────────────────────────────────────────
// Team scope — analogous helpers for TeamMessage mentions.
// ──────────────────────────────────────────────────────────────────

/**
 * Validate candidate user ids against the team's membership. Only
 * team members can be @-mentioned in a team message — pinging
 * someone who can't read the team channel would link them to
 * content they can't access.
 */
export async function resolveAllowedTeamMentionUserIds(
  teamId: string,
  candidateUserIds: string[]
): Promise<string[]> {
  if (candidateUserIds.length === 0) return [];
  const unique = Array.from(new Set(candidateUserIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const members = await prisma.teamMember.findMany({
    where: { teamId, userId: { in: unique } },
    select: { userId: true },
  });
  const allowed = new Set(members.map((m) => m.userId));
  return unique.filter((uid) => allowed.has(uid));
}

interface TeamSyncOptions {
  messageId: string;
  teamId: string;
  actorUserId: string;
  mentionUserIds: string[];
  authorName?: string;
  authorImage?: string | null;
  contentPreview: string;
  rootMessageId?: string;
}

/**
 * Team equivalent of persistMentionsForNewMessage — creates
 * TeamMessageMention rows + Notification fan-out for every mention
 * (skipping the author so people don't ping themselves).
 */
export async function persistTeamMentionsForNewMessage(
  opts: TeamSyncOptions
) {
  const { messageId, teamId, actorUserId, mentionUserIds } = opts;
  if (mentionUserIds.length === 0) return;

  const allowed = await resolveAllowedTeamMentionUserIds(
    teamId,
    mentionUserIds
  );
  if (allowed.length === 0) return;

  await prisma.teamMessageMention.createMany({
    data: allowed.map((userId) => ({
      teamMessageId: messageId,
      userId,
    })),
    skipDuplicates: true,
  });

  const recipients = await gateMentionRecipients(
    allowed.filter((uid) => uid !== actorUserId)
  );
  if (recipients.length === 0) return;

  const title = `${opts.authorName || "Someone"} mentioned you`;
  const preview = opts.contentPreview.slice(0, 140);
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: "MENTIONED" as const,
      title,
      message: preview,
      data: {
        teamMessageId: messageId,
        teamId,
        rootMessageId: opts.rootMessageId ?? messageId,
        authorName: opts.authorName ?? null,
        authorImage: opts.authorImage ?? null,
      },
    })),
  });
}

/**
 * Sync TeamMessageMention rows on an edit. Same diff strategy as
 * the project equivalent: keep rows that should still exist,
 * delete rows that shouldn't, insert new ones, and notify ONLY
 * the freshly-added mentions (re-mentions stay quiet).
 */
export async function syncTeamMentionsForEditedMessage(
  opts: TeamSyncOptions
) {
  const { messageId, teamId, actorUserId, mentionUserIds } = opts;

  const allowed = new Set(
    await resolveAllowedTeamMentionUserIds(teamId, mentionUserIds)
  );

  const existing = await prisma.teamMessageMention.findMany({
    where: { teamMessageId: messageId },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((m) => m.userId));

  const toRemove = [...existingSet].filter((uid) => !allowed.has(uid));
  const toAdd = [...allowed].filter((uid) => !existingSet.has(uid));

  if (toRemove.length > 0) {
    await prisma.teamMessageMention.deleteMany({
      where: { teamMessageId: messageId, userId: { in: toRemove } },
    });
  }

  if (toAdd.length === 0) return;

  await prisma.teamMessageMention.createMany({
    data: toAdd.map((userId) => ({ teamMessageId: messageId, userId })),
    skipDuplicates: true,
  });

  const recipients = await gateMentionRecipients(
    toAdd.filter((uid) => uid !== actorUserId)
  );
  if (recipients.length === 0) return;

  const title = `${opts.authorName || "Someone"} mentioned you`;
  const preview = opts.contentPreview.slice(0, 140);
  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: "MENTIONED" as const,
      title,
      message: preview,
      data: {
        teamMessageId: messageId,
        teamId,
        rootMessageId: opts.rootMessageId ?? messageId,
        authorName: opts.authorName ?? null,
        authorImage: opts.authorImage ?? null,
      },
    })),
  });
}
