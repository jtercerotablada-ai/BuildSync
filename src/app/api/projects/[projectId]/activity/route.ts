import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { dispositionLabel, issuePartyLabel } from "@/lib/deliverables";

// GET /api/projects/:projectId/activity
//
// Aggregates a project-scoped activity feed by pulling from already-
// existing tables (StatusUpdate, ProjectMember.joinedAt, Task.completedAt,
// Task.createdAt, ProjectResource and task Attachment uploads). Returns the
// 30 most recent events normalized into a single shape the UI can render.
//
// Who completed a task is not stored on Task, so the actor comes from the
// task's latest TASK_COMPLETED Activity row (written when a person
// completes it). The assignee is NOT the completer — crediting them
// misattributed the work — so a completion with no such row (e.g. one made
// by a workflow rule) shows no actor.
//
// PRIVACY: reading the project is NOT enough to read every task in it.
// A task marked private is visible only to its creator, its assignee, or
// a workspace manager — decideTaskAccess() 404s it by URL and
// taskPrivacyClause() drops it from every list. This feed derived its
// rows straight from Task.projectId and so printed the NAMES of other
// people's private tasks ("Melvin created a task — <name>") on the
// project Overview, while List, Board, Timeline, Gantt and the Calendar
// all correctly hid them. Both task sources below take the same clause
// the rest of the product uses; do not hand-roll a second rule here.

type ActivityType =
  | "status_update"
  | "member_joined"
  | "task_completed"
  | "task_created"
  | "file_uploaded"
  | "deliverable_sealed"
  | "deliverable_seal_revoked"
  | "deliverable_issued";

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail?: string | null;
  status?: string | null; // For status_update
  /** Deep link for rows that have one (deliverable events). */
  href?: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    // Canonical read rule; an unreadable project is a 404, same as a
    // missing one, so ids cannot be probed.
    const access = await getProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Workspace OWNER/ADMIN hold the key to private tasks everywhere else
    // (decideTaskAccess, the Files tab), so the feed matches.
    const taskVisible = access.isWorkspaceManager
      ? {}
      : taskPrivacyClause(userId);

    // Pull the source rows in parallel. Each query is capped low so we
    // can merge + sort + slice down to 30 without scanning huge tables.
    const [
      statusUpdates,
      members,
      completedTasks,
      recentTasks,
      recentResources,
      recentAttachments,
      deliverableEvents,
    ] = await Promise.all([
        prisma.statusUpdate.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.projectMember.findMany({
          where: { projectId },
          orderBy: { joinedAt: "desc" },
          take: 20,
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.task.findMany({
          where: {
            projectId,
            completed: true,
            completedAt: { not: null },
            ...taskVisible,
          },
          orderBy: { completedAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            completedAt: true,
          },
        }),
        prisma.task.findMany({
          where: { projectId, ...taskVisible },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            createdAt: true,
            creatorId: true,
            creator: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        // Uploads land in ProjectResource (Overview key resources / Files
        // tab) and Attachment (tasks). Links hold no file, so only FILEs.
        prisma.projectResource.findMany({
          where: { projectId, type: "FILE" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            createdAt: true,
            uploader: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        prisma.attachment.findMany({
          where: {
            task: {
              AND: [
                { OR: [{ projectId }, { section: { projectId } }] },
                taskVisible,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            name: true,
            createdAt: true,
            uploader: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
        // Deliverables: the attestations worth seeing on the Overview — a
        // seal, a revoked seal (kept visible on purpose), an issue, and a
        // submittal returned with its disposition. Same read rule as the tab
        // (project read), so nothing here needs its own privacy clause.
        prisma.deliverableEvent.findMany({
          where: {
            type: { in: ["SEALED", "SEAL_REVOKED", "ISSUED", "REVIEWED"] },
            deliverable: { projectId },
          },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            id: true,
            type: true,
            note: true,
            actorName: true,
            createdAt: true,
            deliverableId: true,
            deliverable: { select: { number: true } },
            revision: {
              select: { label: true, issuedToParty: true, disposition: true },
            },
            actor: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        }),
      ]);

    // Latest completion record per task, newest first, so the first row seen
    // for a task is the completion that produced its current completedAt.
    const completionRows = completedTasks.length
      ? await prisma.activity.findMany({
          where: {
            type: "TASK_COMPLETED",
            taskId: { in: completedTasks.map((t) => t.id) },
          },
          orderBy: { createdAt: "desc" },
          select: {
            taskId: true,
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        })
      : [];
    const completerByTask = new Map<
      string,
      (typeof completionRows)[number]["user"]
    >();
    for (const row of completionRows) {
      if (row.taskId && !completerByTask.has(row.taskId)) {
        completerByTask.set(row.taskId, row.user);
      }
    }

    const authorIds = [
      ...new Set(statusUpdates.map((u) => u.authorId).filter(Boolean)),
    ] as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const events: ActivityEvent[] = [];

    // Titles are pre-lowercased so the UI can concatenate them after
    // the actor name without doing presentation logic on the client:
    // "Juan posted a status update", "Maria completed a task", etc.

    for (const u of statusUpdates) {
      const a = u.authorId ? authorMap.get(u.authorId) : null;
      events.push({
        id: `status:${u.id}`,
        type: "status_update",
        title: "posted a status update",
        detail: u.summary.slice(0, 240),
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        actor: a
          ? { id: a.id, name: a.name, email: a.email, image: a.image }
          : null,
      });
    }

    for (const m of members) {
      const niceRole = m.role.charAt(0) + m.role.slice(1).toLowerCase();
      events.push({
        id: `member:${m.id}`,
        type: "member_joined",
        title: `joined as ${niceRole}`,
        detail: null,
        createdAt: m.joinedAt.toISOString(),
        actor: m.user
          ? {
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              image: m.user.image,
            }
          : null,
      });
    }

    for (const t of completedTasks) {
      if (!t.completedAt) continue;
      events.push({
        id: `done:${t.id}`,
        type: "task_completed",
        title: "completed a task",
        detail: t.name,
        createdAt: t.completedAt.toISOString(),
        actor: completerByTask.get(t.id) ?? null,
      });
    }

    for (const t of recentTasks) {
      events.push({
        id: `new:${t.id}`,
        type: "task_created",
        title: "created a task",
        detail: t.name,
        createdAt: t.createdAt.toISOString(),
        actor: t.creator ?? null,
      });
    }

    for (const f of recentResources) {
      events.push({
        id: `file:${f.id}`,
        type: "file_uploaded",
        title: "uploaded a file",
        detail: f.name,
        createdAt: f.createdAt.toISOString(),
        actor: f.uploader ?? null,
      });
    }

    for (const f of recentAttachments) {
      events.push({
        id: `attachment:${f.id}`,
        type: "file_uploaded",
        title: "uploaded a file",
        detail: f.name,
        createdAt: f.createdAt.toISOString(),
        actor: f.uploader ?? null,
      });
    }

    for (const e of deliverableEvents) {
      const rev = e.revision?.label ? ` Rev ${e.revision.label}` : "";
      const subject = `${e.deliverable.number}${rev}`;
      let type: ActivityType;
      let title: string;
      let detail: string | null = null;
      if (e.type === "SEALED") {
        type = "deliverable_sealed";
        title = `sealed ${subject}`;
      } else if (e.type === "SEAL_REVOKED") {
        type = "deliverable_seal_revoked";
        title = `revoked the seal on ${subject}`;
        detail = e.note;
      } else if (e.type === "ISSUED") {
        type = "deliverable_issued";
        // The party lives on the event's note ("Rev 0 → Client: Bayview");
        // the revision's own column is gone once an issue is undone.
        const party =
          /→\s*([^:·]+)/.exec(e.note ?? "")?.[1]?.trim() ||
          issuePartyLabel(e.revision?.issuedToParty) ||
          null;
        title = party ? `issued ${subject} → ${party}` : `issued ${subject}`;
        detail = /preliminary/.test(e.note ?? "") ? "Preliminary (not sealed)" : null;
      } else {
        type = "deliverable_issued";
        const disp =
          /—\s*(.+)$/.exec(e.note ?? "")?.[1]?.trim() ||
          dispositionLabel(e.revision?.disposition) ||
          null;
        title = disp ? `returned ${subject} — ${disp}` : `returned ${subject}`;
      }
      events.push({
        id: `deliverable:${e.id}`,
        type,
        title,
        detail,
        href: `/projects/${projectId}?view=deliverables&deliverable=${e.deliverableId}`,
        createdAt: e.createdAt.toISOString(),
        // The actor row may be gone (user deleted); the snapshot name stays.
        actor: e.actor
          ? e.actor
          : e.actorName
            ? { id: "", name: e.actorName, email: null, image: null }
            : null,
      });
    }

    // ISO 8601 + UTC ("Z") sorts lexicographically the same as
    // chronologically, but using getTime() is more defensive in case
    // a future change introduces non-UTC strings.
    events.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(events.slice(0, 30));
  } catch (err) {
    console.error("[project activity GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch project activity" },
      { status: 500 }
    );
  }
}
