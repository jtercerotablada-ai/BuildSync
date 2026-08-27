import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isNonContributorRole } from "@/lib/workspace-roles";
import { ProjectContent } from "@/components/projects/project-content";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function PortalProjectPage({
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

  // Check access.
  //
  // PUBLIC used to grant read on its own here, with no workspace comparison —
  // so any signed-in user of ANY workspace could open this project through the
  // portal. PUBLIC means "everyone in THIS workspace", never "everyone with an
  // account"; both PUBLIC and WORKSPACE now require the viewer to be in the
  // project's own workspace.
  const isOwner = project.ownerId === user.id;
  const isMember = project.members.some((m) => m.userId === user.id);

  // The membership's ROLE is load-bearing, not just its existence. A
  // NON-CONTRIBUTOR (GUEST / CLIENT — see NON_CONTRIBUTOR_ROLES) must not get
  // the workspace-wide grant: this is a server component that renders the same
  // <ProjectContent> as the internal cockpit, budget and member emails
  // included, and those roles have no client-facing surface at all any more.
  // Matches the rule in @/lib/project-access and the (dashboard) project page.
  let isInProjectWorkspace = false;
  if (!isOwner && !isMember) {
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: project.workspaceId,
        },
      },
      select: { role: true },
    });
    isInProjectWorkspace =
      !!workspaceMember && !isNonContributorRole(workspaceMember.role);
  }

  const hasAccess =
    isOwner ||
    isMember ||
    (isInProjectWorkspace &&
      (project.visibility === "PUBLIC" || project.visibility === "WORKSPACE"));

  if (!hasAccess) {
    notFound();
  }

  // Serialize the project data for client component.
  // Prisma's Decimal type doesn't survive JSON.stringify cleanly, so we
  // coerce `budget` to a plain number here.
  const serializedProject = {
    ...project,
    budget: project.budget != null ? Number(project.budget) : null,
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
