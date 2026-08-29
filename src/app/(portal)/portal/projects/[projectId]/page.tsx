import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getLevel } from "@/lib/people-types";
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
  // The role, not just the presence, of the viewer's ProjectMember row — the
  // control gates further down are per-role.
  const viewerProjectRole =
    project.members.find((m) => m.userId === user.id)?.role ?? null;
  const isMember = viewerProjectRole !== null;

  // The membership's ROLE is load-bearing, not just its existence. A
  // NON-CONTRIBUTOR (GUEST / CLIENT — see NON_CONTRIBUTOR_ROLES) must not get
  // the workspace-wide grant: this is a server component that renders the same
  // <ProjectContent> as the internal cockpit, budget and member emails
  // included, and those roles have no client-facing surface at all any more.
  // Matches the rule in @/lib/project-access and the (dashboard) project page.
  //
  // The lookup is unconditional now because the write affordances below need
  // the viewer's workspace standing even when ownership or membership already
  // settled the read. `isInProjectWorkspace` keeps its exact former value —
  // it stays the "neither owner nor member" grant and nothing else.
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: project.workspaceId,
      },
    },
    include: { user: { select: { position: true } } },
  });
  const viewerIsContributor =
    !!workspaceMember && !isNonContributorRole(workspaceMember.role);
  const isInProjectWorkspace = !isOwner && !isMember && viewerIsContributor;

  const hasAccess =
    isOwner ||
    isMember ||
    (isInProjectWorkspace &&
      (project.visibility === "PUBLIC" || project.visibility === "WORKSPACE"));

  if (!hasAccess) {
    notFound();
  }

  // ── Which CONTROLS the page may render ───────────────────────
  // Resolved here rather than in <ProjectContent>, which can only match the
  // session email against the project's owner and members and is therefore
  // blind to WORKSPACE role. The READ rule above is this page's own (it grants
  // WORKSPACE visibility, which project-access deliberately does not); the
  // WRITE rules below are the API's, because they gate buttons that call it.
  //
  // Workspace-manager standing is consulted only for a viewer who is neither
  // the project's owner nor one of its members — the same condition
  // resolveProjectAccess applies before it looks the membership up, so the
  // control and the route can't disagree about who may delete.
  const isWorkspaceManager =
    !isOwner &&
    !isMember &&
    viewerIsContributor &&
    !!workspaceMember &&
    (workspaceMember.role === "OWNER" ||
      workspaceMember.role === "ADMIN" ||
      getLevel(workspaceMember.user.position) >= 4);

  // canEdit mirrors PATCH /api/projects/[projectId] — owner, or a project
  // ADMIN/EDITOR. Archive and Unarchive ARE that PATCH, so they ride on it.
  // canManage mirrors DELETE, which enforces `access.canManage`. The second is
  // not a subset of the first: a workspace manager may delete a project he may
  // not rename, because the two routes genuinely disagree. A NON-CONTRIBUTOR
  // (GUEST / CLIENT) gets neither, even through an explicit ownership or
  // membership grant — src/proxy.ts default-denies those roles across /api/,
  // so every one of these controls would answer 403 for them. That gate reads
  // the viewer's PRIMARY workspace role off the JWT, not their standing in the
  // project's workspace, and the two are different values for anyone who
  // belongs to more than one — so the flag reads the same role the gate does.
  const viewerMayCallApi = !isNonContributorRole(session.user.role);
  const canEditProject =
    viewerMayCallApi &&
    (isOwner ||
      viewerProjectRole === "ADMIN" ||
      viewerProjectRole === "EDITOR");
  const canManageProject =
    viewerMayCallApi &&
    (isOwner || viewerProjectRole === "ADMIN" || isWorkspaceManager);

  // What DELETE /api/sections/:id actually removes: every task carrying that
  // sectionId — sub-tasks included, multi-homed guests excluded, since those
  // keep their HOME section id. Computed here as well as on the dashboard
  // route because this page renders the very same List / Board / Workflow
  // views, and an EDITOR reaching a project through the portal gets the same
  // "Delete section" item. Without it every view falls back to its rendered
  // row count and the confirmation understates the delete — the bug this
  // number exists to prevent. Seeded with zeros first: groupBy returns no row
  // for an empty section, and a missing key re-enables that same fallback.
  const sectionTaskCounts = {
    ...Object.fromEntries(project.sections.map((s) => [s.id, 0])),
    ...Object.fromEntries(
      (
        await prisma.task.groupBy({
          by: ["sectionId"],
          where: { sectionId: { in: project.sections.map((s) => s.id) } },
          _count: { _all: true },
        })
      ).map((g) => [g.sectionId as string, g._count._all])
    ),
  } as Record<string, number>;

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

  return (
    <ProjectContent
      project={serializedProject}
      currentView={view}
      sectionTaskCounts={sectionTaskCounts}
      canEdit={canEditProject}
      canManage={canManageProject}
    />
  );
}
