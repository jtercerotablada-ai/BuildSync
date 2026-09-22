import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

/**
 * The feed token is HMAC(NEXTAUTH_SECRET, uid[:key]). `key` is a random
 * per-user value kept in UserPreferences.uiState.calendarFeed.key, so a
 * leaked or no-longer-wanted feed URL can be killed for ONE user by rotating
 * it (POST below) — before this, the token was HMAC(uid) alone and the only
 * way to revoke a URL was rotating NEXTAUTH_SECRET, logging everyone out.
 * Users who never reset keep the key-less token, so existing subscriptions
 * keep working until they choose to reset.
 *
 * The same derivation lives in ../route.ts (a route file may only export
 * handlers); keep the two identical.
 */
function feedToken(secret: string, uid: string, key: string | null): string {
  return crypto
    .createHmac("sha256", secret)
    .update(key ? `${uid}:${key}` : uid)
    .digest("hex");
}

function readFeedKey(uiState: unknown): string | null {
  if (!uiState || typeof uiState !== "object") return null;
  const feed = (uiState as Record<string, unknown>).calendarFeed;
  if (!feed || typeof feed !== "object") return null;
  const key = (feed as Record<string, unknown>).key;
  return typeof key === "string" && key ? key : null;
}

function feedUrl(request: NextRequest, uid: string, token: string): string {
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("host") || "localhost:3000";
  return `${proto}://${host}/api/my-tasks/calendar-feed?uid=${encodeURIComponent(uid)}&token=${token}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = session.user.id;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: uid },
      select: { uiState: true },
    });
    const token = feedToken(secret, uid, readFeedKey(prefs?.uiState));

    return NextResponse.json({ url: feedUrl(request, uid, token) });
  } catch (error) {
    console.error("Calendar feed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar feed URL" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/my-tasks/calendar-feed/url — reset the link. Writes a fresh
 * random key, which invalidates every URL handed out before, and returns
 * the new one.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = session.user.id;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const key = crypto.randomBytes(16).toString("hex");

    // Read-merge-write of the uiState JSON, serializable like the
    // preferences route's own merge, so a concurrent preference save can
    // neither drop this key nor be dropped by it.
    const writeKey = () =>
      prisma.$transaction(
        async (tx) => {
          const existing = await tx.userPreferences.findUnique({
            where: { userId: uid },
            select: { uiState: true },
          });
          const current =
            existing?.uiState && typeof existing.uiState === "object" && !Array.isArray(existing.uiState)
              ? (existing.uiState as Record<string, unknown>)
              : {};
          const merged = {
            ...current,
            calendarFeed: { key, resetAt: new Date().toISOString() },
          } as Prisma.InputJsonValue;
          await tx.userPreferences.upsert({
            where: { userId: uid },
            update: { uiState: merged },
            create: { userId: uid, uiState: merged },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

    for (let attempt = 1; ; attempt++) {
      try {
        await writeKey();
        break;
      } catch (error) {
        const retriable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 3;
        if (!retriable) throw error;
      }
    }

    return NextResponse.json({ url: feedUrl(request, uid, feedToken(secret, uid, key)) });
  } catch (error) {
    console.error("Calendar feed URL reset error:", error);
    return NextResponse.json(
      { error: "Failed to reset the calendar feed URL" },
      { status: 500 }
    );
  }
}
