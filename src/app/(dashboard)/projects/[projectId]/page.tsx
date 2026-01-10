import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProjectContent } from "@/components/projects/project-content";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const session = await getServerSession(authOptions);
  const { projectId } = await params;
  const { view = "list" } = await searchParams;

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      sections: {
        orderBy: { position: "asc" },
        include: {
          tasks: {
            where: {
              parentTaskId: null,
            },
            orderBy: { position: "asc" },
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              subtasks: {
                select: {
                  id: true,
                  completed: true,
                },
              },
              _count: {
                select: {
                  subtasks: true,
                  comments: true,
                  attachments: true,
                },
              },
            },
          },
        },
      },
      views: true,
    },
  });

  if (!project) {
    notFound();
  }

  // Check access
  const hasAccess =
    project.ownerId === user.id ||
    project.members.some((m) => m.userId === user.id) ||
    project.visibility === "PUBLIC";

  if (!hasAccess && project.visibility === "WORKSPACE") {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: project.workspaceId,
        },
      },
    });

    if (!workspaceMember) {
      notFound();
    }
  } else if (!hasAccess) {
    notFound();
  }

  // Serialize the project data for client component
  const serializedProject = {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    startDate: project.startDate?.toISOString() || null,
    endDate: project.endDate?.toISOString() || null,
    members: project.members.map((m) => ({
      ...m,
      joinedAt: m.joinedAt.toISOString(),
    })),
    sections: project.sections.map((s) => ({
      ...s,
      tasks: s.tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate?.toISOString() || null,
        startDate: t.startDate?.toISOString() || null,
        completedAt: t.completedAt?.toISOString() || null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    })),
  };

  return <ProjectContent project={serializedProject} currentView={view} />;
}
