import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { sendInvitationEmail } from "@/lib/email";
import { WORKSPACE_ROLE_META } from "@/lib/people-types";
import type { WorkspaceRole } from "@prisma/client";

/**
 * POST /api/workspace/invitations/:id/resend
 *
 * Re-sends the same invitation email and extends its expiration to
 * "now + 7 days". The token doesn't rotate — the same magic link
 * stays valid (the original may still be in the recipient's inbox).
 *
 * Access: workspace OWNER or ADMIN in the invitation's workspace.
 */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const currentMember = await prisma.workspaceMember.findFirst({
      where: { userId },
      select: {
        workspaceId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (
      !currentMember ||
      !["OWNER", "ADMIN"].includes(currentMember.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invitation = await prisma.workspaceInvitation.findFirst({
      where: {
        id,
        workspaceId: currentMember.workspaceId,
        status: "PENDING",
      },
      include: {
        workspace: { select: { name: true } },
        inviter: { select: { name: true, email: true } },
      },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: "Pending invitation not found" },
        { status: 404 }
      );
    }

    // Extend expiration to keep the link viable for another 7 days.
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const updated = await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { expiresAt },
      select: { id: true, expiresAt: true },
    });

    // Resolve project name for the email payload, if the invite was
    // bound to one. Done separately because `include` with a string
    // relation name isn't typed.
    let projectName: string | null = null;
    if (invitation.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: invitation.projectId },
        select: { name: true },
      });
      projectName = project?.name ?? null;
    }

    const inviterName =
      invitation.inviter?.name ||
      invitation.inviter?.email ||
      currentMember.user.name ||
      "A teammate";

    await sendInvitationEmail({
      email: invitation.email,
      token: invitation.token,
      inviterName,
      workspaceName: invitation.workspace.name,
      roleLabel:
        WORKSPACE_ROLE_META[invitation.role as WorkspaceRole]?.label ||
        invitation.role,
      personalMessage: invitation.personalMessage,
      projectName,
    });

    return NextResponse.json({
      id: updated.id,
      expiresAt: updated.expiresAt.toISOString(),
      success: true,
    });
  } catch (err) {
    console.error("[invitations resend] error:", err);
    return NextResponse.json(
      { error: "Failed to resend invitation" },
      { status: 500 }
    );
  }
}
