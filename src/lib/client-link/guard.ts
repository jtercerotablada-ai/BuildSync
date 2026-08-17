/**
 * Shared server-side helpers for the client-link staff API.
 *
 * Lives outside the route files because Next's App Router only permits HTTP
 * method handlers (and a small set of config exports) to be exported from a
 * `route.ts`.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Only the project owner or an ADMIN member may mint, list or revoke a client
 * link. This is the same gate as `requireProjectAdmin` in
 * src/app/api/projects/[projectId]/members/route.ts, on purpose: handing an
 * outsider a working URL into the project is at least as sensitive as adding
 * a member, so it must not fall back to the broader EDITOR gate that guards
 * ordinary project edits.
 *
 * Returns null on success, or the NextResponse the caller should return.
 */
export async function requireProjectAdmin(
  userId: string,
  projectId: string
): Promise<NextResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const isOwner = project.ownerId === userId;
  const isAdmin = project.members[0]?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      {
        error:
          "Only the project owner or an ADMIN member can manage client links",
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Absolute origin for the link handed back to staff.
 *
 * Built from the request rather than from APP_URL because APP_URL is unset in
 * local development and falls back to :3000 — which would hand a developer
 * running on :3002 a URL that 404s. Forwarded headers win so this stays
 * correct behind Vercel's proxy.
 */
export function originFrom(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? null;
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }
  return process.env.APP_URL ?? "http://localhost:3000";
}
