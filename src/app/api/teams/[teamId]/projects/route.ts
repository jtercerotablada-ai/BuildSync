import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    const projects = await prisma.project.findMany({
      where: { teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Format projects with isJoined flag
    const formattedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      icon: project.icon,
      color: project.color,
      members: project.members.map((m) => ({
        id: m.user.id,
        name: m.user.name || "",
        image: m.user.image,
      })),
      isJoined: project.members.some((m) => m.userId === userId),
    }));

    return NextResponse.json(formattedProjects);
  } catch (error) {
    console.error("Error fetching team projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
