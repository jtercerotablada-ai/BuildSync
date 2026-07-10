import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ProjectContent } from "@/components/projects/project-content";
import { getLevel } from "@/lib/people-types";

// Shared task shape for both the project's own tasks and the tasks
// multi-homed INTO it — keeps the two queries structurally identical.
const TASK_INCLUDE = {
  assignee: {
    select: { id: true, name: true, email: true, image: true },
  },
  creator: {
    select: { id: true, name: true, email: true, image: true },
  },
  subtasks: { select: { id: true, completed: true } },
  dependencies: {
    select: {
      blockingTask: { select: { id: true, name: true, completed: true } },
    },
  },
  dependents: {
    select: {
      dependentTask: { select: { id: true, name: true, completed: true } },
    },
  },
  taskTags: {
    select: { tag: { select: { id: true, name: true, color: true } } },
  },
  _count: {
    select: {
      subtasks: true,
      comments: true,
      attachments: true,
      likes: true,
    },
  },
} satisfies Prisma.TaskInclude;

type ProjectTaskPayload = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

// Coerce a task's DateTime fields to ISO strings for the client. Used
// for both the project's own tasks and multi-homed ones so they share
// one shape.
function serializeProjectTask(t: ProjectTaskPayload) {
  return {
    ...t,
    dueDate: t.dueDate?.toISOString() || null,
    startDate: t.startDate?.toISOString() || null,
    completedAt: t.completedAt?.toISOString() || null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

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
            include: TASK_INCLUDE,
          },
        },
      },
      views: true,
    },
  });

  if (!project) {
    notFound();
  }

  // ── Per-workspace access check ───────────────────────────────
  // Read the user's role + position relative to THIS project's
  // workspace (not the user's primary workspace) so multi-workspace
  // users don't get leaked access via their OWNER status elsewhere.
  const isProjectOwner = project.ownerId === user.id;
  const isProjectMember = project.members.some((m) => m.userId === user.id);
  const isPublic = project.visibility === "PUBLIC";

  let hasAccess = isProjectOwner || isProjectMember || isPublic;

  if (!hasAccess) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: project.workspaceId,
        },
      },
      include: { user: { select: { position: true } } },
    });
    if (membership) {
      const role = membership.role;
      const level = getLevel(membership.user.position);
      if (role === "OWNER" || role === "ADMIN" || level >= 4) {
        hasAccess = true;
      }
    }
  }

  if (!hasAccess) {
    notFound();
  }

  // Multi-homing: tasks whose HOME is another project but that were
  // added to THIS project (TaskProject rows). Render them under the
  // section recorded on their TaskProject link (fallback: first section).
  const firstSectionId = project.sections[0]?.id ?? null;
  const multiHomedTasks = await prisma.task.findMany({
    where: { parentTaskId: null, taskProjects: { some: { projectId } } },
    orderBy: { position: "asc" },
    include: {
      ...TASK_INCLUDE,
      taskProjects: { where: { projectId }, select: { sectionId: true } },
    },
  });
  const multiHomedBySection = new Map<
    string,
    ReturnType<typeof serializeProjectTask>[]
  >();
  for (const t of multiHomedTasks) {
    const targetSection = t.taskProjects[0]?.sectionId ?? firstSectionId;
    if (!targetSection) continue;
    const { taskProjects: _tp, ...rest } = t;
    void _tp;
    const arr = multiHomedBySection.get(targetSection) ?? [];
    arr.push(serializeProjectTask(rest));
    multiHomedBySection.set(targetSection, arr);
  }

  // Serialize the project data for client component.
  // Prisma's Decimal type doesn't survive JSON.stringify cleanly, so we
  // coerce `budget` to a plain number here (loses precision past 15
  // significant digits, fine for any realistic project budget).
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
      tasks: [
        ...s.tasks.map(serializeProjectTask),
        ...(multiHomedBySection.get(s.id) ?? []),
      ],
    })),
  };

  return <ProjectContent project={serializedProject} currentView={view} />;
}
