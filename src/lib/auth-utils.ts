import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import prisma from "./prisma";
import { getLevel, getDepartment } from "./people-types";
import type { EffectiveAccess } from "./access-control";

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
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) return null;

  // Prefer a workspace with more than one member — that's the user's
  // "real" workspace, not the auto-generated singleton from signup.
  const realWorkspace = memberships.find(
    (m) => m.workspace._count.members > 1
  );
  const chosen = realWorkspace ?? memberships[0];

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

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  return { valid: true, message: "" };
}
