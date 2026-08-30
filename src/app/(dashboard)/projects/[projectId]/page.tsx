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
import { getLevel } from "@/lib/people-types";
import { canReadProject } from "@/lib/project-access";
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
              // task list and search use — never a fourth copy.
              ...taskPrivacyClause(user.id),
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

  // ── Per-workspace access check ───────────────────────────────
  // Read the user's role + position relative to THIS project's
  // workspace (not the user's primary workspace) so multi-workspace
  // users don't get leaked access via their OWNER status elsewhere.
  const isProjectOwner = project.ownerId === user.id;
  const isProjectMember = project.members.some((m) => m.userId === user.id);
  // Team sharing: members of the project's team have access too (mirrors
  // resolveProjectAccess, the canonical rule the API sub-routes enforce). Only
  // honor a team that lives in the project's OWN workspace — never grant or
  // display across the workspace boundary.
  const sharedTeam =
    project.team && project.team.workspaceId === project.workspaceId
      ? project.team
      : null;
  // Resolve the viewer's standing in the PROJECT's workspace ONCE, before any
  // grant is computed — both IMPLICIT grants below (team sharing, and the
  // workspace-wide PUBLIC grant) are gated on it.
  //
  // A NON-CONTRIBUTOR (GUEST / CLIENT — see NON_CONTRIBUTOR_ROLES) gets neither.
  // This page is a server component: past the gate below it serializes budget,
  // member emails, every task and the view prefs into the response, and a
  // read-only role has no business receiving any of it. `level >= 4` has to sit
  // behind the same check — Position is independent of WorkspaceRole, so a
  // GUEST carrying an executive Position would otherwise become a workspace
  // manager and read PRIVATE projects too.
  //
  // EXPLICIT grants are deliberately untouched: a non-contributor who owns the
  // project or holds a real ProjectMember row still gets in. Only the "everyone
  // in the workspace / everyone on the team" shortcuts are withdrawn.
  //
  // Mirrors the identical condition in resolveProjectAccess — the two copies
  // existing at all is the drift hazard project-access.ts warns about, kept
  // only because this page resolves membership inline.
  const viewerMembership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: project.workspaceId,
      },
    },
    include: { user: { select: { position: true } } },
  });
  // CONTRIBUTOR membership, not merely "has a row": a viewer with NO membership
  // at all must be refused by the team branch too. Removing someone from a
  // workspace deletes only their WorkspaceMember row and leaves their
  // TeamMember rows behind, so an offboarded user with a stale team row would
  // otherwise keep reading every project shared with that team.
  const viewerIsContributor =
    !!viewerMembership && !isNonContributorRole(viewerMembership.role);

  const isProjectTeamMember =
    viewerIsContributor &&
    (sharedTeam?.members.some((m) => m.userId === user.id) ?? false);

  let isWorkspaceManager = false;
  const viewerWorkspaceIds: string[] = [];
  // Owner/member only — team membership must NOT suppress this, because
  // resolveProjectAccess resolves the team AFTER the workspace role and never
  // lets it. Adding a third term here made a workspace OWNER who happens to
  // sit on the team a project is shared with stop being a manager of it, and
  // the delete gate below reads this flag.
  if (!isProjectOwner && !isProjectMember) {
    if (viewerIsContributor && viewerMembership) {
      viewerWorkspaceIds.push(project.workspaceId);
      const role = viewerMembership.role;
      const level = getLevel(viewerMembership.user.position);
      isWorkspaceManager = role === "OWNER" || role === "ADMIN" || level >= 4;
    }
  }

  // One shared decision with the API routes — see canReadProject's comment.
  const hasAccess = canReadProject({
    visibility: project.visibility,
    projectWorkspaceId: project.workspaceId,
    viewerWorkspaceIds,
    isOwner: isProjectOwner,
    isMember: isProjectMember,
    isWorkspaceManager,
    isTeamMember: isProjectTeamMember,
  });

  if (!hasAccess) {
    notFound();
  }

  // ── Which CONTROLS the page may render ───────────────────────
  // Resolved here rather than in <ProjectContent>: the client can only match
  // the session email against the project's owner and members, which is blind
  // to WORKSPACE role. Deletion turns on exactly that role, so the client
  // could not state the rule at all and the menu item ended up gated on
  // nothing — a reader was offered the irreversible control and denied the
  // reversible one. Each flag mirrors the route its control calls; neither may
  // be more permissive than that route, or the button dead-ends in a 403.
  const viewerProjectRole =
    project.members.find((m) => m.userId === user.id)?.role ?? null;
  // A NON-CONTRIBUTOR (GUEST / CLIENT) gets no write affordance at all, not
  // even through the explicit ownership/membership grant that let them read:
  // src/proxy.ts default-denies those roles across the /api/ surface, so every
  // one of these controls would answer 403 for them.
  //
  // It has to be the role that gate actually reads — the PRIMARY workspace
  // one, off the JWT — not `viewerIsContributor`, which is standing in THIS
  // project's workspace. The two are different values for anyone who belongs
  // to more than one workspace, and reading the wrong one both hid the
  // controls from owners the API obeys and offered them where the middleware
  // answers 403 before the handler is reached.
  const viewerMayCallApi = !isNonContributorRole(session.user.role);

  // canEdit mirrors PATCH /api/projects/[projectId] — owner, or a project
  // ADMIN/EDITOR. Archive and Unarchive ARE that PATCH, so they ride on it.
  // Deliberately not `canWrite` from project-access: the route grants neither
  // team members nor workspace managers the edit.
  const canEditProject =
    viewerMayCallApi &&
    (isProjectOwner ||
      viewerProjectRole === "ADMIN" ||
      viewerProjectRole === "EDITOR");
  // canManage mirrors DELETE, which enforces `access.canManage` — owner,
  // project ADMIN, or workspace manager. It is NOT a subset of canEditProject:
  // the two routes genuinely disagree, and a workspace manager may delete a
  // project he may not rename. Mirroring each route beats reconciling them
  // here; the server stays the gate.
  const canManageProject =
    viewerMayCallApi &&
    (isProjectOwner || viewerProjectRole === "ADMIN" || isWorkspaceManager);

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
    },
    orderBy: { position: "asc" },
    include: {
      ...TASK_INCLUDE,
      taskProjects: { where: { projectId }, select: { sectionId: true } },
    },
  });
  // What DELETE /api/sections/:id actually removes: every task carrying that
  // sectionId — sub-tasks included, guest (multi-homed) tasks excluded, since
  // those keep their HOME section id. The rendered section.tasks list is
  // neither (it hides sub-tasks and adds guests), so the delete confirm needs
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
          where: { sectionId: { in: project.sections.map((s) => s.id) } },
          _count: { _all: true },
        })
      ).map((g) => [g.sectionId as string, g._count._all])
    ),
  } as Record<string, number>;

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
      canEdit={canEditProject}
      canManage={canManageProject}
      initialTabOrder={savedTabOrder}
      initialGanttPrefs={savedGanttPrefs}
    />
  );
}
