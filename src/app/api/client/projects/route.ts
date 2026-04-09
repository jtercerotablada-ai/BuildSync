import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
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

    const accesses = await prisma.clientProjectAccess.findMany({
      where: { userId: user.id },
      include: {
        project: {
          include: {
            tasks: {
              select: { id: true, completed: true },
            },
            owner: {
              select: { name: true },
            },
          },
        },
      },
    });

    const projects = accesses.map((a) => {
      const total = a.project.tasks.length;
      const completed = a.project.tasks.filter((t) => t.completed).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: a.project.id,
        name: a.project.name,
        description: a.project.description,
        status: a.project.status,
        color: a.project.color,
        startDate: a.project.startDate,
        endDate: a.project.endDate,
        progress,
        totalTasks: total,
        completedTasks: completed,
        ownerName: a.project.owner?.name || "Unknown",
        canComment: a.canComment,
        canUpload: a.canUpload,
        canApprove: a.canApprove,
      };
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Client projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
