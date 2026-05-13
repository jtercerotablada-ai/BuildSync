import prisma from "@/lib/prisma";

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

/**
 * Validate a list of candidate user ids against the project's
 * allowed audience (owner + members + workspace members when the
 * project is WORKSPACE-visible). Returns the subset that is
 * actually allowed to be mentioned.
 *
 * Mentions outside this set are dropped on the server — clients
 * shouldn't be able to ping users who can't see the project
 * anyway, because the resulting notification would link to a
 * message they can't read.
 */
export async function resolveAllowedMentionUserIds(
  projectId: string,
  candidateUserIds: string[]
): Promise<string[]> {
  if (candidateUserIds.length === 0) return [];

  const unique = Array.from(new Set(candidateUserIds.filter(Boolean)));
  if (unique.length === 0) return [];

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true } },
    },
  });
  if (!project) return [];

  const allowed = new Set<string>();
  if (project.ownerId) allowed.add(project.ownerId);
  for (const m of project.members) allowed.add(m.userId);

  // For WORKSPACE-visible projects, expand the allowlist to anyone
  // in the workspace.
  if (project.visibility === "WORKSPACE") {
    const wsMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: project.workspaceId,
        userId: { in: unique },
      },
      select: { userId: true },
    });
    for (const wm of wsMembers) allowed.add(wm.userId);
  }

  return unique.filter((uid) => allowed.has(uid));
}

interface SyncOptions {
  messageId: string;
  projectId: string | null;
  actorUserId: string;
  mentionUserIds: string[];
  // When provided, used as the notification title. Falls back to
  // a sensible default if omitted.
  authorName?: string;
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
  const recipients = allowed.filter((uid) => uid !== actorUserId);
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
  const recipients = toAdd.filter((uid) => uid !== actorUserId);
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
      },
    })),
  });
}
