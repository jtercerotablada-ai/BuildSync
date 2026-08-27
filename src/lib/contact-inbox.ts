import prisma from "@/lib/prisma";

/**
 * Who may read the public contact-form inbox.
 *
 * ContactSubmission is a GLOBAL table (prisma/schema.prisma) — the leads the
 * firm receives through the marketing site's contact form. It carries no
 * workspaceId and no relation, so "may I read it?" cannot be answered by
 * scoping a query; it needs an explicit notion of "the firm".
 *
 * ── The hole this closes ──────────────────────────────────────────────────
 * Both readers used to gate on `workspaceMember.findFirst({ where: { userId } })`
 * plus `role in (OWNER, ADMIN)`. Self-signup is open at /register and
 * onboarding makes every new user the OWNER of their own personal workspace,
 * so that test passed for ANY account on the internet — and the query behind
 * it returns every lead the firm has ever received (name, email, phone,
 * service, full message). The role was never the firm's role; it was the
 * attacker's role in their own workspace.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 * The caller must be OWNER or ADMIN **of the firm's workspace**, resolved as:
 *
 *   1. CONTACT_INBOX_WORKSPACE_ID when set — explicit, and the right answer if
 *      the deployment ever hosts more than one firm.
 *   2. Otherwise the oldest workspace that STILL HAS an OWNER or ADMIN. An
 *      attacker cannot forge a row older than the firm's — no workspace-create
 *      path accepts a client-supplied createdAt — so "oldest" is not
 *      manipulable. Verified against production on 2026-08-26: the oldest row
 *      is the firm's (3 members, 6 projects) and the three later ones are
 *      personal singletons.
 *
 *      The OWNER/ADMIN requirement matters because Workspace.ownerId is
 *      onDelete: SetNull while WorkspaceMember.userId is onDelete: Cascade —
 *      so a self-serve account deletion (DELETE /api/users/account) can leave
 *      a workspace alive with zero members. Without this filter such a
 *      tombstone would be selected forever and NOBODY could read the inbox.
 *
 * PIN IT IN PRODUCTION. The fallback is a safety net, not the intended answer:
 * set CONTACT_INBOX_WORKSPACE_ID so the choice cannot drift with the data.
 *
 * Deliberately NOT used here: getUserWorkspaceId()'s "prefer a workspace with
 * more than one member" heuristic. That resolves which workspace a user works
 * in — for a solo attacker it resolves to their own personal workspace, where
 * they are OWNER, so it would leave the hole wide open.
 */
export async function resolveContactInboxWorkspaceId(): Promise<string | null> {
  const configured = (process.env.CONTACT_INBOX_WORKSPACE_ID ?? "").trim();
  if (configured) return configured;

  const oldest = await prisma.workspace.findFirst({
    where: { members: { some: { role: { in: ["OWNER", "ADMIN"] } } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!oldest) return null;

  // A denial that traces back to the fallback picking the wrong workspace is
  // otherwise invisible from both sides — the firm silently 403s and someone
  // else silently gets in. Name the workspace that was chosen.
  console.warn(
    `[contact-inbox] CONTACT_INBOX_WORKSPACE_ID is unset; falling back to the oldest workspace with an OWNER/ADMIN (${oldest.id}). Pin the env var to make this explicit.`,
  );
  return oldest.id;
}

/**
 * True when `userId` may read/manage the contact inbox. Fails CLOSED: if no
 * workspace exists at all, nobody gets in.
 */
export async function canReadContactInbox(userId: string): Promise<boolean> {
  const workspaceId = await resolveContactInboxWorkspaceId();
  if (!workspaceId) return false;

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (!membership) return false;

  return membership.role === "OWNER" || membership.role === "ADMIN";
}
