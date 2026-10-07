import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import {
  PROJECT_TAB_ORDER_KEY,
  savedTabOrderFor,
  type ProjectTabOrderMap,
} from "@/lib/project-views";
import {
  GANTT_PREFS_KEY,
  ganttPrefsFor,
  type GanttPrefsMap,
} from "@/lib/gantt-prefs";
import prisma from "@/lib/prisma";
import { ProjectContent } from "@/components/projects/project-content";
import { resolveProjectAccess } from "@/lib/project-access";
import { isNonContributorRole } from "@/lib/workspace-roles";
import { taskPrivacyClause } from "@/lib/project-visibility";

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
  // The default landing view is resolved from the project's view prefs below
  // (Asana's "Set as default"); an explicit ?view= always wins.
  const { view: viewParam } = await searchParams;

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    // The tab order is a per-user preference, and the strip is above the
    // fold: resolving it here rather than letting the client fetch it
    // after mount is what keeps the tabs from re-shuffling on load. It
    // rides the user lookup that already runs, so it costs no round trip.
    include: { preferences: { select: { uiState: true } } },
  });

  if (!user) {
    return null;
  }

  // Workspace OWNER/ADMIN of the project's workspace read private tasks, as
  // decideTaskAccess and the project sub-routes (attachments, activity,
  // duplicate) already let them. The section tasks load in the query below,
  // before resolveProjectAccess runs, so the same fact is read up front: it is
  // the very workspaceMember row the resolver reads for isWorkspaceManager.
  const managerSeat = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN"] },
      workspace: { projects: { some: { id: projectId } } },
    },
    select: { id: true },
  });
  const sectionTaskPrivacy = managerSeat ? {} : taskPrivacyClause(user.id);

  // Defence in depth: never even LOAD a project the viewer has no possible
  // claim on. The OR below is a superset of every grant path canReadProject
  // recognises (workspace membership, ownership, project membership, team
  // sharing), so it can only reject users the gate further down would reject
  // anyway — while making a cross-tenant id guess miss at the query level.
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { workspace: { members: { some: { userId: user.id } } } },
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
        { team: { members: { some: { userId: user.id } } } },
      ],
    },
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
              // A task flagged private is visible to the people tied to it, and
              // the board is the widest surface it appears on: without this a
              // colleague reads its name, assignee and due date in List, Board
              // and Timeline, then gets a 404 on opening it. Same clause the
              // task list and search use — never a fourth copy. Workspace
              // managers are exempt (see sectionTaskPrivacy above).
              ...sectionTaskPrivacy,
            },
            orderBy: { position: "asc" },
            include: TASK_INCLUDE,
          },
        },
      },
      views: true,
      viewPrefs: true,
      // The team this project is shared with (Asana model): its members get
      // access and appear in "Project roles" as team members.
      team: {
        select: {
          id: true,
          name: true,
          workspaceId: true,
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Resolve the landing view: an explicit ?view= wins; otherwise the tab the
  // user pinned as default ("Set as default"); otherwise List.
  const defaultViewPref = project.viewPrefs.find((p) => p.isDefault && !p.hidden);
  const view = viewParam ?? defaultViewPref?.viewKey ?? "list";

  // ── Access ───────────────────────────────────────────────
  // Delegated to resolveProjectAccess — the SAME decision every API route
  // makes — rather than an inline copy of it: the copies are how this page,
  // the portal page and the API ended up granting different people.
  const access = await resolveProjectAccess(project, user.id);
  if (!access.ok) {
    notFound();
  }

  // Team sharing: only honor a team that lives in the project's OWN
  // workspace — never display across the workspace boundary.
  const sharedTeam =
    project.team && project.team.workspaceId === project.workspaceId
      ? project.team
      : null;

  // ── Which CONTROLS the page may render ───────────────────────
  // Resolved here rather than in <ProjectContent>: the client can only match
  // the session email against the project's owner and members, which is blind
  // to WORKSPACE role and visibility grants. Each flag mirrors the route its
  // control calls, so no button dead-ends in a 403.
  //
  // A NON-CONTRIBUTOR (GUEST / CLIENT) gets no write affordance at all:
  // src/proxy.ts default-denies those roles across the /api/ surface, so every
  // control would answer 403. It has to be the role that gate actually reads —
  // the PRIMARY workspace one, off the JWT — not standing in THIS project's
  // workspace; the two differ for anyone in more than one workspace.
  const viewerMayCallApi = !isNonContributorRole(session.user.role);

  // canEdit mirrors PATCH /api/projects/[projectId] (access.canWrite); Archive
  // and Unarchive ARE that PATCH. canManage mirrors DELETE (access.canManage).
  const canEditProject = viewerMayCallApi && access.canWrite;
  const canManageProject = viewerMayCallApi && access.canManage;

  // Multi-homing: tasks whose HOME is another project but that were
  // added to THIS project (TaskProject rows). Render them under the
  // section recorded on their TaskProject link (fallback: first section).
  const firstSectionId = project.sections[0]?.id ?? null;
  const multiHomedTasks = await prisma.task.findMany({
    // `projectId: { not: projectId }` is defence in depth: a task that is both
    // homed here AND carries a guest link here would otherwise render twice in
    // the same column — once from sections.include.tasks and once from here —
    // giving two cards the same React key. The write side keeps the two
    // mutually exclusive; this makes a stale link harmless rather than visible.
    // The OR is not decoration: `projectId: { not: projectId }` compiles to
    // SQL `"projectId" <> $1`, which is UNKNOWN — and therefore excluding —
    // for rows where projectId IS NULL. A projectless personal task added to
    // this project as a guest would silently drop off the board. Spelling out
    // the null arm keeps three-valued logic from eating it.
    where: {
      parentTaskId: null,
      taskProjects: { some: { projectId } },
      OR: [{ projectId: null }, { projectId: { not: projectId } }],
      // A private task added to this project is still private: without the
      // clause its name, assignee and dates render on this board for every
      // reader, who then gets a 404 opening it. Nested under AND because the
      // clause carries its own OR. Workspace managers are exempt, as above.
      AND: [access.isWorkspaceManager ? {} : taskPrivacyClause(user.id)],
    },
    orderBy: { position: "asc" },
    include: {
      ...TASK_INCLUDE,
      taskProjects: { where: { projectId }, select: { sectionId: true } },
    },
  });
  // What DELETE /api/sections/:id actually removes: the section's TOP-LEVEL
  // tasks (their sub-task trees go with them, and the dialog says "plus their
  // sub-tasks"). Counted by parentTaskId: null because a sub-task carrying
  // this sectionId may belong to a parent in another column (the route
  // re-homes those) or already be covered by its parent here. Guest
  // (multi-homed) tasks are excluded, since those keep their HOME section id.
  // The rendered section.tasks list adds guests, so the delete confirm needs
  // this number rather than a row count.
  const sectionTaskCounts = {
    // Seeded with an explicit zero for EVERY section before the real counts
    // land on top. groupBy returns no row at all for a section holding no
    // tasks, and a missing key sends the delete confirmation to its
    // `?? section.tasks.length` fallback — which counts multi-homed GUEST
    // cards that this delete does not touch. An empty first column showing
    // one borrowed card would otherwise warn "all 1 of its task ... This
    // cannot be undone", and demand the section name be typed, for a delete
    // that removes nothing. A key that is present and 0 says so honestly.
    ...Object.fromEntries(project.sections.map((s) => [s.id, 0])),
    ...Object.fromEntries(
      (
        await prisma.task.groupBy({
          by: ["sectionId"],
          where: {
            sectionId: { in: project.sections.map((s) => s.id) },
            parentTaskId: null,
          },
          _count: { _all: true },
        })
      ).map((g) => [g.sectionId as string, g._count._all])
    ),
  } as Record<string, number>;

  // What deleting the PROJECT destroys: every task homed here, sub-tasks and
  // tasks outside any column included. The per-section counts above are
  // top-level only (the right number for a column delete), so summing them
  // understated a project delete by every checklist item.
  const projectTaskCount = await prisma.task.count({
    where: { projectId: project.id },
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

  // This viewer's own arrangement of the tab strip, read through the same
  // helper the client uses so the stored shape has exactly one reader. It
  // is per-user (uiState), unlike the shared hidden/rename rows on
  // ProjectViewPref, so it cannot be resolved from the project alone.
  const savedTabOrder =
    savedTabOrderFor(
      (user.preferences?.uiState as { [PROJECT_TAB_ORDER_KEY]?: ProjectTabOrderMap } | null)
        ?.[PROJECT_TAB_ORDER_KEY],
      project.id
    ) ?? null;

  // Same read, one key over: the Gantt's remembered zoom, folds and Options
  // for this project. Resolved here for the reason the tab order is — the
  // client hook only reaches uiState from an effect, so the chart would open
  // at the defaults for a beat, and a click inside that beat wrote those
  // defaults back over the stored folds (the server's uiState merge replaces
  // the object under a project id). It rides the user lookup that already
  // runs, so it costs no round trip.
  const savedGanttPrefs = ganttPrefsFor(
    (
      user.preferences?.uiState as {
        [GANTT_PREFS_KEY]?: GanttPrefsMap;
      } | null
    )?.[GANTT_PREFS_KEY],
    project.id
  );

  // Serialize the project data for client component.
  // Prisma's Decimal type doesn't survive JSON.stringify cleanly, so we
  // coerce `budget` to a plain number here (loses precision past 15
  // significant digits, fine for any realistic project budget).
  const serializedProject = {
    ...project,
    // Drop the deprecated single-doc Notes column: the Notes tab reads
    // ProjectNote rows now, and this can be 100KB of dead payload on every
    // project page load. (`include` keeps all scalars, hence the explicit
    // undefined rather than a full `select` rewrite of the query.)
    notes: undefined,
    budget: project.budget != null ? Number(project.budget) : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    startDate: project.startDate?.toISOString() || null,
    endDate: project.endDate?.toISOString() || null,
    regulatoryDeadline: project.regulatoryDeadline?.toISOString() || null,
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
    // Per-project view-tab customization (rename / default / copies / hidden).
    viewPrefs: project.viewPrefs.map((p) => ({
      id: p.id,
      viewKey: p.viewKey,
      baseView: p.baseView,
      label: p.label,
      hidden: p.hidden,
      isDefault: p.isDefault,
      position: p.position,
    })),
    // Team sharing: drop the raw nested team (Date fields) and expose a flat
    // shape the Overview uses to render team members in "Project roles". Uses
    // the workspace-validated `sharedTeam` so a cross-workspace team is never
    // surfaced.
    team: undefined,
    teamName: sharedTeam?.name ?? null,
    teamMembers: (sharedTeam?.members ?? []).map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
    })),
  };

  return (
    <ProjectContent
      project={serializedProject}
      currentView={view}
      sectionTaskCounts={sectionTaskCounts}
      projectTaskCount={projectTaskCount}
      canEdit={canEditProject}
      canManage={canManageProject}
      initialTabOrder={savedTabOrder}
      initialGanttPrefs={savedGanttPrefs}
    />
  );
}
