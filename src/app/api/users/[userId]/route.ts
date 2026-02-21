import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        jobTitle: true,
        bio: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentUserId = await getCurrentUserId();
    const isOwnProfile = currentUserId === targetUserId;

    let sharedWorkspaces: { id: string; name: string }[] = [];
    let sharedProjects: { id: string; name: string; color: string }[] = [];

    if (currentUserId && !isOwnProfile) {
      // Find workspaces both users are members of
      const currentUserWorkspaces = await prisma.workspaceMember.findMany({
        where: { userId: currentUserId },
        select: { workspaceId: true },
      });
      const currentWsIds = currentUserWorkspaces.map((w) => w.workspaceId);

      const targetUserWorkspaces = await prisma.workspaceMember.findMany({
        where: {
          userId: targetUserId,
          workspaceId: { in: currentWsIds },
        },
        select: {
          workspace: { select: { id: true, name: true } },
        },
      });
      sharedWorkspaces = targetUserWorkspaces.map((w) => w.workspace);

      // Find projects both users are members of
      const currentUserProjects = await prisma.projectMember.findMany({
        where: { userId: currentUserId },
        select: { projectId: true },
      });
      const currentProjIds = currentUserProjects.map((p) => p.projectId);

      const targetUserProjects = await prisma.projectMember.findMany({
        where: {
          userId: targetUserId,
          projectId: { in: currentProjIds },
        },
        select: {
          project: { select: { id: true, name: true, color: true } },
        },
      });
      sharedProjects = targetUserProjects.map((p) => p.project);
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      image: user.image,
      jobTitle: user.jobTitle,
      bio: user.bio,
      emailVerified: !!user.emailVerified,
      createdAt: user.createdAt,
      ...(isOwnProfile ? { email: user.email } : {}),
      sharedWorkspaces,
      sharedProjects,
      isOwnProfile,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}
