import { NextResponse } from "next/server";
import { getCurrentUserId, getEffectiveAccess } from "@/lib/auth-utils";

/**
 * GET /api/me/access
 *
 * The current user's "effective access" bundle — WorkspaceRole +
 * Position + derived level + department. Client code (sidebar,
 * guards, conditional UI) reads from this single endpoint so the
 * access logic stays centralized in `lib/access-control.ts`.
 *
 * Cache rules:
 *   • `Cache-Control: no-store` — access can change mid-session
 *     (admin promotes a user, position update, etc.) so we always
 *     re-read.
 *   • Browser hooks may keep an in-memory copy + refresh on
 *     focus / route change. The API itself never caches.
 *
 * Returns 401 when the user has no session, 404 when they're
 * signed in but not yet a workspace member (orphan account).
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const access = await getEffectiveAccess(userId);
    if (!access) {
      return NextResponse.json(
        { error: "No workspace membership" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(access, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[me/access] error:", err);
    return NextResponse.json(
      { error: "Failed to resolve access" },
      { status: 500 }
    );
  }
}
