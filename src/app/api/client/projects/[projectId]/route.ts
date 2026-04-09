import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyClientAccess } from "@/lib/auth-guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
      await verifyClientAccess(user.id, projectId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, image: true },
        },
        sections: {
          orderBy: { position: "asc" },
          include: {
            tasks: {
              select: {
                id: true,
                name: true,
                completed: true,
                completedAt: true,
                dueDate: true,
                taskType: true,
                assignee: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
          },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true, jobTitle: true },
            },
          },
        },
        files: {
          orderBy: { createdAt: "desc" },
          include: {
            uploader: { select: { name: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const allTasks = project.sections.flatMap((s) => s.tasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.completed).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const milestones = allTasks
      .filter((t) => t.taskType === "MILESTONE")
      .map((t) => ({
        id: t.id,
        name: t.name,
        dueDate: t.dueDate,
        completed: t.completed,
      }));

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      color: project.color,
      startDate: project.startDate,
      endDate: project.endDate,
      progress,
      totalTasks,
      completedTasks,
      ownerName: project.owner?.name || "Unknown",
      milestones,
      teamMembers: project.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        jobTitle: m.user.jobTitle,
      })),
      documents: project.files.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        size: f.size,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
        uploaderName: f.uploader.name,
      })),
    });
  } catch (error) {
    console.error("Client project detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
