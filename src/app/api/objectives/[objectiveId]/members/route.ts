import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { notifyObjectiveShared } from "@/lib/objective-notifications";
import {
  objectiveAccessDenied,
  resolveObjectiveAccess,
} from "@/lib/objective-access";

/**
 * GET    /api/objectives/:id/members — list members of an objective
 * POST   /api/objectives/:id/members — add a member (owner-only)
 * DELETE /api/objectives/:id/members?userId= — remove a member
 *                                              (owner-only; member
 *                                              can leave themselves)
 *
 * Access: any user who can SEE the objective (owner, team member,
 * existing member) can GET the member list. Only the OWNER can
 * POST a new member or DELETE someone else.
 *
 * Adding a member fires a notifyObjectiveShared() so the new member
 * sees "X shared this objective with you" in their inbox.
 */

const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["EDITOR", "VIEWER"]).optional(),
});

async function loadObjectiveWithAccess(
  objectiveId: string,
  userId: string
): Promise<
  | { ok: true; objective: { id: string; name: string; ownerId: string | null; workspaceId: string; teamId: string | null }; isOwner: boolean; canSee: boolean }
  | { ok: false; status: number; error: string }
> {
  // The shared goal gate first, and it already answers in this function's
  // shape: an unknown goal and a private one this caller isn't on come back
  // identically (404), so neither can be told apart by poking ids.
  const gate = await resolveObjectiveAccess(objectiveId, userId);
  if (!gate.ok) {
    return gate;
  }

  // Only the field the gate doesn't carry — the name goes into the "shared
  // this objective with you" notification.
  const obj = await prisma.objective.findUnique({
    where: { id: objectiveId },
    select: { name: true },
  });
  if (!obj) {
    return objectiveAccessDenied();
  }

  const isOwner = gate.isOwner;
  let isTeamMember = false;
  if (gate.objective.teamId) {
    const tm = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: gate.objective.teamId } },
      select: { id: true },
    });
    isTeamMember = !!tm;
  }
  // Kept on top of the gate, which admits any workspace contributor to an
  // ordinary goal: the member list has always been for people actually on it.
  const canSee = isOwner || isTeamMember || gate.isMember;
  if (!canSee) {
    // 404 (not 403) masks existence.
    return objectiveAccessDenied();
  }

  return {
    ok: true,
    objective: {
      id: gate.objective.id,
      name: obj.name,
      ownerId: gate.objective.ownerId,
      workspaceId: gate.objective.workspaceId,
      teamId: gate.objective.teamId,
    },
    isOwner,
    canSee,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { objectiveId } = await params;

    const access = await loadObjectiveWithAccess(objectiveId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const members = await prisma.objectiveMember.findMany({
      where: { objectiveId },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      }))
    );
  } catch (err) {
    console.error("[objective members GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load members" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { objectiveId } = await params;

    const access = await loadObjectiveWithAccess(objectiveId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.isOwner) {
      return NextResponse.json(
        { error: "Only the objective owner can add members" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = addSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }
    const { userId: targetUserId, role } = parsed.data;

    // Target must be a workspace member of the objective's workspace.
    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUserId,
          workspaceId: access.objective.workspaceId,
        },
      },
      select: { id: true },
    });
    if (!targetMembership) {
      return NextResponse.json(
        { error: "User is not a member of this workspace" },
        { status: 400 }
      );
    }

    // Already a member?
    const existing = await prisma.objectiveMember.findUnique({
      where: {
        objectiveId_userId: { objectiveId, userId: targetUserId },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "User is already a member of this objective" },
        { status: 400 }
      );
    }

    const member = await prisma.objectiveMember.create({
      data: {
        objectiveId,
        userId: targetUserId,
        role: role ?? "EDITOR",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Fire inbox notification — best-effort, never blocks.
    try {
      await notifyObjectiveShared({
        objectiveId,
        recipientUserId: targetUserId,
        sharerUserId: userId,
        objectiveName: access.objective.name,
      });
    } catch (err) {
      console.error("[objective members POST] notify failed:", err);
    }

    return NextResponse.json(
      {
        id: member.id,
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
        user: member.user,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[objective members POST] error:", err);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { objectiveId } = await params;

    const access = await loadObjectiveWithAccess(objectiveId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    if (!targetUserId) {
      return NextResponse.json(
        { error: "userId required" },
        { status: 400 }
      );
    }

    // Members can always remove themselves. Removing OTHERS requires
    // owner.
    if (targetUserId !== userId && !access.isOwner) {
      return NextResponse.json(
        { error: "Only the objective owner can remove other members" },
        { status: 403 }
      );
    }

    await prisma.objectiveMember.delete({
      where: {
        objectiveId_userId: { objectiveId, userId: targetUserId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[objective members DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
