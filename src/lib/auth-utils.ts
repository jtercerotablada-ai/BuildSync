import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";
import { getLevel, getDepartment } from "./people-types";
import type { EffectiveAccess } from "./access-control";
import {
  pickPrimaryMembership,
  primaryWorkspacePin,
} from "./workspace-roles";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  return user;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id;
}

/**
 * Resolve the user's effective access — WorkspaceRole + Position
 * level + Department — in ONE round trip. Use at the top of every
 * server component / API route that gates content by hierarchy.
 *
 * ── Multi-workspace heuristic ──────────────────────────────────
 * A user may belong to multiple workspaces: their auto-generated
 * personal workspace from signup (where they're OWNER, member
 * count = 1) plus the firm workspace they were invited to (where
 * they're MEMBER alongside others).
 *
 * Returning the older one (joinedAt asc) leaks OWNER status from
 * the personal workspace into UI gates everywhere, which is the
 * wrong default — the firm workspace is where the user actually
 * works.
 *
 * Heuristic: prefer the FIRST workspace with > 1 member. Single-
 * member workspaces are treated as auto-generated and only used
 * if no multi-member workspace exists.
 *
 * Returns null when:
 *   - the user has no session
 *   - the user has no workspace membership (orphan account)
 *
 * The caller should treat null as 401 / redirect to /login.
 */
export async function getEffectiveAccess(
  userId: string
): Promise<EffectiveAccess | null> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      role: true,
      workspaceId: true,
      joinedAt: true,
      user: { select: { position: true } },
      workspace: {
        select: { _count: { select: { members: true } } },
      },
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
  });
  // One shared pick (see pickPrimaryMembership) — this used to be its own
  // copy of the heuristic, without the id tiebreak.
  const chosen = pickPrimaryMembership(memberships, primaryWorkspacePin());
  if (!chosen) return null;

  const position = chosen.user.position;
  return {
    userId,
    workspaceId: chosen.workspaceId,
    workspaceRole: chosen.role,
    position,
    level: getLevel(position),
    department: getDepartment(position),
  };
}

/* Moved to ./password-policy so client screens can share the SAME rule — this
   module is server-only (Prisma, getServerSession). Re-exported so the existing
   server-side imports of `validatePassword` from here keep working. */
export { validatePassword } from "./password-policy";
