import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getPrimaryWorkspaceMembership } from "@/lib/auth-guards";
import { readJson } from "@/lib/http";
import { isNonContributorRole } from "@/lib/workspace-roles";
import {
  DeliverableHttpError,
  deliverableErrorResponse,
  requireCaller,
} from "@/lib/deliverable-http";

/**
 * GET / PUT /api/workspace/seal-authority — who may record PE seals.
 *
 * OWNER-ONLY, on the workspace named by `workspaceId` (query on GET, body on
 * PUT) — the Deliverables tab passes the PROJECT's workspace, which is the
 * seat canSeal reads. Without it, the caller's PRIMARY workspace
 * (pickPrimaryMembership via getPrimaryWorkspaceMembership — never a bare
 * findFirst). Anyone who is not OWNER of that workspace gets a 404: the
 * setting is not theirs to know about. The OWNER's own seal right is
 * implicit (decideSealAuthority); he can still record his license number.
 *
 * GET ?workspaceId= → { members: [{ userId, name, image, role, sealAuthorizedAt,
 *                     peLicenseNo, isOwner }] }   (contributors only)
 * PUT { workspaceId?, userId, authorized: boolean, peLicenseNo?: string | null }
 *     → { member: <same shape> }
 */

async function ownerWorkspace(
  userId: string,
  workspaceId?: string | null
): Promise<string | null> {
  if (workspaceId) {
    const seat = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });
    return seat?.role === "OWNER" ? workspaceId : null;
  }
  const m = await getPrimaryWorkspaceMembership(userId);
  return m && m.role === "OWNER" ? m.workspaceId : null;
}

const memberSelect = {
  userId: true,
  role: true,
  sealAuthorizedAt: true,
  peLicenseNo: true,
  user: { select: { name: true, image: true } },
} as const;

type MemberRow = {
  userId: string;
  role: string;
  sealAuthorizedAt: Date | null;
  peLicenseNo: string | null;
  user: { name: string | null; image: string | null };
};

function toJSON(m: MemberRow) {
  return {
    userId: m.userId,
    name: m.user.name,
    image: m.user.image,
    role: m.role,
    sealAuthorizedAt: m.sealAuthorizedAt ? m.sealAuthorizedAt.toISOString() : null,
    peLicenseNo: m.peLicenseNo,
    isOwner: m.role === "OWNER",
  };
}

export async function GET(req: Request) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const requested = new URL(req.url).searchParams.get("workspaceId");
    const workspaceId = await ownerWorkspace(caller.id, requested);
    if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: memberSelect,
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({
      members: rows.filter((r) => !isNonContributorRole(r.role)).map(toJSON),
    });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to load seal authority");
  }
}

const putSchema = z.object({
  workspaceId: z.string().min(1).nullable().optional(),
  userId: z.string().min(1),
  authorized: z.boolean(),
  peLicenseNo: z
    .string()
    .max(40, "The license number is too long.")
    .nullable()
    .optional()
    .transform((s) => (s == null ? s : s.trim() || null)),
});

export async function PUT(req: Request) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const data = putSchema.parse(await readJson(req));
    const workspaceId = await ownerWorkspace(caller.id, data.workspaceId);
    if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const seat = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: data.userId, workspaceId } },
      select: { id: true, role: true, sealAuthorizedAt: true },
    });
    if (!seat || isNonContributorRole(seat.role)) {
      throw new DeliverableHttpError(
        400,
        "Only contributors of this workspace can be given seal authority."
      );
    }

    const isOwner = seat.role === "OWNER";
    const updated = await prisma.workspaceMember.update({
      where: { id: seat.id },
      data: {
        // An OWNER's right is implicit; the switch does not apply to him.
        ...(isOwner
          ? {}
          : {
              sealAuthorizedAt: data.authorized
                ? seat.sealAuthorizedAt ?? new Date()
                : null,
            }),
        ...(data.peLicenseNo !== undefined ? { peLicenseNo: data.peLicenseNo } : {}),
      },
      select: memberSelect,
    });
    return NextResponse.json({ member: toJSON(updated) });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to update seal authority");
  }
}
