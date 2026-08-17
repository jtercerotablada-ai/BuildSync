/**
 * Resolving a client share token to a link.
 *
 * This is the authentication half of the password-less client link. The
 * authorisation half — what the holder may actually see — lives in
 * ./projection and nowhere else.
 */

import prisma from "@/lib/prisma";
import { hashToken, isWellFormedToken } from "./token";

export interface ResolvedShareLink {
  id: string;
  projectId: string;
  label: string;
}

/**
 * Resolve a plaintext token to the link it names, or null.
 *
 * Null is returned identically for "no such link", "revoked" and "expired".
 * The caller 404s all three, so the response never distinguishes a token that
 * was never valid from one that was — a revoked board president cannot learn
 * that his link once existed, and an attacker probing the space cannot use the
 * status code as an oracle.
 *
 * Revocation and expiry are evaluated HERE, on every single request, rather
 * than being baked into something cached at creation time. A link is only ever
 * as live as the current call.
 */
export async function resolveShareLink(
  token: unknown
): Promise<ResolvedShareLink | null> {
  // Cheap structural pre-filter: anything that is not the exact hex we mint
  // cannot match a stored hash, so don't spend a query on it.
  if (!isWellFormedToken(token)) return null;

  // Look up BY HASH. The plaintext is never stored and never compared.
  const link = await prisma.projectShareLink.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      projectId: true,
      label: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!link) return null;
  if (link.revokedAt !== null) return null;
  if (link.expiresAt.getTime() <= Date.now()) return null;

  return { id: link.id, projectId: link.projectId, label: link.label };
}

/**
 * Record that a link was opened: bump the counter, stamp the time.
 *
 * Deliberately swallows every error. This is telemetry for the firm's own
 * "has the owner actually looked at it yet?" question — it must never be the
 * reason a client staring at a blank page instead of their project. The page
 * has already been authorised by the time this runs.
 */
export async function recordVisit(linkId: string): Promise<void> {
  try {
    await prisma.projectShareLink.update({
      where: { id: linkId },
      data: {
        lastSeenAt: new Date(),
        viewCount: { increment: 1 },
      },
    });
  } catch {
    // Intentionally ignored — see above.
  }
}
