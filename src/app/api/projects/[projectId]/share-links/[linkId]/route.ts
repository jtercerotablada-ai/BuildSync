/**
 * Revoke or extend a single client share link.
 *
 * There is deliberately no way to read the token back, and no way to
 * "un-revoke": revocation is one-way, because the reason you revoke is that
 * the URL reached someone it should not have, and that cannot be undone by
 * flipping a column back.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, getErrorStatus } from "@/lib/auth-guards";
import { requireProjectAdmin } from "@/lib/client-link/guard";

const EXTEND_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const patchSchema = z.object({
  action: z.enum(["revoke", "extend"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; linkId: string }> }
) {
  try {
    const { projectId, linkId } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyProjectAccess(userId, projectId);
    const forbidden = await requireProjectAdmin(userId, projectId);
    if (forbidden) return forbidden;

    const { action } = patchSchema.parse(await req.json());

    // Scope the lookup to the project from the URL. Without this, a project
    // admin on project A could revoke or extend a link belonging to project
    // B just by knowing its id.
    const existing = await prisma.projectShareLink.findFirst({
      where: { id: linkId, projectId },
      select: { id: true, revokedAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (action === "extend" && existing.revokedAt !== null) {
      // Extending a revoked link would silently resurrect a URL someone
      // already decided to kill.
      return NextResponse.json(
        { error: "This link is revoked. Create a new one instead." },
        { status: 409 }
      );
    }

    const link = await prisma.projectShareLink.update({
      where: { id: existing.id },
      data:
        action === "revoke"
          ? { revokedAt: new Date() }
          : { expiresAt: new Date(Date.now() + EXTEND_DAYS * DAY_MS) },
      select: {
        id: true,
        label: true,
        email: true,
        createdAt: true,
        lastSeenAt: true,
        viewCount: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return NextResponse.json({ link });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[share-links] PATCH failed:", error);
    return NextResponse.json(
      { error: "Failed to update client link" },
      { status: 500 }
    );
  }
}
