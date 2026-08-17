/**
 * Client share links for a project — create and list.
 *
 * A share link is a password-less, revocable, expiring URL handed to a
 * building owner. The plaintext token exists for exactly one HTTP response
 * (the POST that mints it) and is never stored, logged or retrievable.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { verifyProjectAccess, getErrorStatus } from "@/lib/auth-guards";
import { rateLimit } from "@/lib/rate-limit";
import { mintToken } from "@/lib/client-link/token";
import { requireProjectAdmin, originFrom } from "@/lib/client-link/guard";

const DEFAULT_EXPIRY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

const createSchema = z.object({
  label: z.string().trim().min(1).max(120),
  // Recorded so staff know who they sent it to. Never rendered on /p/.
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  expiresInDays: z.number().int().min(1).max(365).default(DEFAULT_EXPIRY_DAYS),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyProjectAccess(userId, projectId);
    const forbidden = await requireProjectAdmin(userId, projectId);
    if (forbidden) return forbidden;

    // Minting is cheap for us and valuable to anyone who has taken a staff
    // session: every call produces a fresh, working, unauthenticated URL.
    const limit = rateLimit(`share-link:create:${userId}`, 20, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many links created. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    const data = createSchema.parse(await req.json());
    const { token, tokenHash } = mintToken();

    const link = await prisma.projectShareLink.create({
      data: {
        tokenHash,
        projectId,
        label: data.label,
        email: data.email ? data.email : null,
        createdById: userId,
        expiresAt: new Date(Date.now() + data.expiresInDays * DAY_MS),
      },
      select: {
        id: true,
        label: true,
        email: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // The ONLY time the plaintext leaves the server. No endpoint can return
    // it again — re-sending means minting a new link, which is the semantics
    // the firm wants anyway.
    return NextResponse.json(
      {
        link: {
          id: link.id,
          label: link.label,
          email: link.email,
          expiresAt: link.expiresAt,
          createdAt: link.createdAt,
          lastSeenAt: null,
          viewCount: 0,
          revokedAt: null,
        },
        url: `${originFrom(req)}/p/${token}`,
      },
      { status: 201 }
    );
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
    console.error("[share-links] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to create client link" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await verifyProjectAccess(userId, projectId);
    const forbidden = await requireProjectAdmin(userId, projectId);
    if (forbidden) return forbidden;

    // Note the absence of tokenHash. Nothing about the secret — not even its
    // digest — is sent to the browser.
    const links = await prisma.projectShareLink.findMany({
      where: { projectId },
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
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ links });
  } catch (error) {
    const { status, message } = getErrorStatus(error);
    if (status !== 500) {
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[share-links] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load client links" },
      { status: 500 }
    );
  }
}
