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
 * Returns null when:
 *   - the user has no session
 *   - the user has no workspace membership (orphan account)
 *
 * The caller should treat null as 401 / redirect to /login.
 */
export async function getEffectiveAccess(
  userId: string
): Promise<EffectiveAccess | null> {
  const row = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: {
      role: true,
      workspaceId: true,
      user: { select: { position: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
  if (!row) return null;

  const position = row.user.position;
  return {
    userId,
    workspaceId: row.workspaceId,
    workspaceRole: row.role,
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
