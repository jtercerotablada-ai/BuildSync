import { NextResponse } from "next/server";
import { z } from "zod";
import type { ProjectGate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { deleteFile } from "@/lib/storage";
import { GoalProgressService } from "@/lib/goal-progress";
import { taskPrivacyClause } from "@/lib/project-visibility";
import { getProjectAccess, resolveProjectAccess } from "@/lib/project-access";
import {
  isStageValidForType,
  legacyGateFor,
  stageDirection,
  stagesForType,
} from "@/lib/pipelines";

/**
 * The owner of a blob uploaded through a public form (`forms/<formId>/...`)
 * or a tracking reply (`tracking/<submissionId>/...`); null for any other
 * path. Same folder rule as isSubmissionBlob in the task delete routes.
 */
function submissionBlobOwner(
  url: string
): { folder: "forms" | "tracking"; id: string } | null {
  try {
    const [folder, id] = new URL(url).pathname.replace(/^\/+/, "").split("/");
    if ((folder === "forms" || folder === "tracking") && id) {
      return { folder, id };
    }
    return null;
  } catch {
    return null;
  }
}

// Schedule dates arrive as ISO strings. Validate them at the edge so a
// malformed one comes back as a 400 naming the field, instead of reaching
// Prisma as an `Invalid Date` and falling through to the generic 500. An
// empty string is still accepted: the handler below reads it as "no date".
const dateString = z
  .string()
  .refine((s) => s === "" || !Number.isNaN(Date.parse(s)), "Invalid date");

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  notes: z.string().max(100000).optional().nullable(),
  color: z.string().optional(),
  status: z.enum(["ON_TRACK", "AT_RISK", "OFF_TRACK", "ON_HOLD", "COMPLETE"]).optional(),
  visibility: z.enum(["PRIVATE", "WORKSPACE", "PUBLIC"]).optional(),
  isArchived: z.boolean().optional(),
  startDate: dateString.optional().nullable(),
  endDate: dateString.optional().nullable(),
  // Engineering firm extensions — mirrors the create schema in route.ts
  type: z.enum(["CONSTRUCTION", "DESIGN", "RECERTIFICATION", "PERMIT", "BSIP"]).optional().nullable(),
  // Still parsed, never applied — see the rejection in the handler.
  gate: z.enum(["PRE_DESIGN", "DESIGN", "PERMITTING", "CONSTRUCTION", "CLOSEOUT"]).optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  budget: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
});

// GET /api/projects/:projectId - Get project details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        },
        views: true,
        // Portfolios this project is connected to — powers the Share
        // dialog's "This project is connected to N portfolio(s)" line.
        // Cheap select on the already-loaded payload; no extra round-trip.
        portfolios: {
          select: {
            portfolio: { select: { id: true, name: true } },
          },
        },
        // Counted with the caller's own visibility, not a bare
        // `tasks: true`. A relation count ignores privacy, so the card
        // said "3 tasks" to someone who could open one of them — the
        // number disagreed with every list that renders it.
        _count: {
          select: {
            tasks: { where: taskPrivacyClause(userId) },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // ── Per-workspace access control ─────────────────────────
    // Delegated to resolveProjectAccess so this endpoint cannot drift from the
    // project page and the sub-routes. It used to keep its own copy of the
    // rule, and that copy let `visibility === "PUBLIC"` short-circuit the
    // workspace check entirely — any signed-in user of ANY workspace could
    // read the full project payload by id. resolveProjectAccess scopes PUBLIC
    // to the owning workspace.
    const access = await resolveProjectAccess(project, userId);

    if (!access.ok) {
      // Forward the resolver's own status and message (404 "Project not
      // found"), the way PATCH does below. A 403 "Access denied" confirmed the
      // id exists, which is exactly the probing the 404 is there to prevent.
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Flatten the portfolio join into a plain [{ id, name }] list the
    // Share dialog can render directly ("connected to N portfolio(s)")
    // without walking the nested `portfolios[].portfolio` relation. The
    // raw `portfolios` relation is left on the payload for backward
    // compatibility.
    const connectedPortfolios = project.portfolios.map((p) => p.portfolio);

    return NextResponse.json({ ...project, connectedPortfolios });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:projectId - Update project
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = updateProjectSchema.parse(body);

    // Canonical access resolution (scopes PUBLIC to the owning workspace, so a
    // cross-tenant caller gets 404 here rather than a read they can act on).
    const access = await getProjectAccess(projectId, userId);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // The canonical write rule — owner, project ADMIN/EDITOR, workspace
    // OWNER/ADMIN, or an implicit Editor grant (team sharing, WORKSPACE/PUBLIC
    // visibility). This route used to keep its own owner|ADMIN|EDITOR copy, so
    // the firm owner could DELETE a colleague's project but not archive or
    // rename it.
    if (!access.canWrite) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project" },
        { status: 403 }
      );
    }

    // Visibility is an ACCESS-CONTROL field, not project content. An EDITOR
    // could previously flip a project to PUBLIC and widen who can read it —
    // privilege escalation dressed up as an ordinary edit. Restrict it to the
    // people who already manage the project's membership: owner, project
    // ADMIN, or a workspace OWNER/ADMIN (access.canManage).
    if (data.visibility !== undefined && !access.canManage) {
      return NextResponse.json(
        { error: "Only a project admin can change visibility" },
        { status: 403 }
      );
    }

    // `gate` is SERVER-DERIVED from `stage` now, so a caller that sets it
    // directly desyncs the pair the next screen reads. Rejected rather than
    // accepted-and-ignored on purpose: silently dropping the write leaves a
    // phase picker that looks like it saved and snaps back on the next load,
    // and nobody ever finds out why. The 400 names the endpoint that does move
    // a job, so the caller gets fixed instead of quietly doing nothing.
    if (data.gate !== undefined) {
      return NextResponse.json(
        {
          error:
            "Phase is derived from the project's stage. Move the stage with PATCH /api/projects/:projectId/stage instead.",
        },
        { status: 400 }
      );
    }

    const updatedProject = await prisma.$transaction(async (tx) => {
      // A type change re-homes the project into a different pipeline, which can
      // leave a stage key that belongs to nobody (a recert key on a design job).
      let stageChange: {
        stage: string | null;
        stageEnteredAt: Date | null;
        stageBlocker: null;
        gate: ProjectGate;
      } | null = null;
      let seedEvent: {
        fromStage: string | null;
        toStage: string;
      } | null = null;

      let typeChanged = false;
      if (data.type !== undefined) {
        // Read inside the transaction, alongside the write it decides: a stage
        // move landing between the two would otherwise be recorded as the
        // stage this job came from, and the history would name a move that
        // never happened.
        const current = await tx.project.findUnique({
          where: { id: projectId },
          select: { type: true, stage: true },
        });

        // RECERTIFICATION → BSIP is a reclassification, not a move: both run the
        // same pipeline, so the stage is still valid and the clock must survive.
        // Nothing is touched unless the current stage genuinely stops belonging.
        typeChanged = !!current && data.type !== current.type;
        if (
          current &&
          data.type !== current.type &&
          !isStageValidForType(data.type, current.stage)
        ) {
          // Seed to the new pipeline's first stage rather than clearing it. A
          // typed project with no stage is a hole: the strip only offers "Set
          // stage" for a job with no TYPE, and every board that groups by stage
          // silently drops the job — which is the one thing this feature exists
          // to prevent. Seeding is also exactly what the backfill did to all six
          // live rows, so a re-typed job behaves like every other one, and the
          // SEED direction says plainly that this is not progress. The stage it
          // came from survives in the event's fromStage; the firm clicks it
          // forward once.
          const first = stagesForType(data.type)[0] ?? null;
          stageChange = {
            stage: first?.key ?? null,
            // A new pipeline starts a new clock; without a stage there is none.
            stageEnteredAt: first ? new Date() : null,
            // The blocker described a stage that no longer exists here.
            stageBlocker: null,
            gate: legacyGateFor(first?.key ?? null),
          };
          // Clearing a type leaves no toStage to record, and the column is NOT
          // NULL — an un-set is representable only as the absence of a row.
          if (first) {
            seedEvent = { fromStage: current.stage, toStage: first.key };
          }
        }
      }

      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : data.startDate === null ? null : undefined,
          endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
          // A STATUS HAS TO BE EARNED. `status` defaults to ON_TRACK, so every
          // project claimed to be fine from the moment it was created, whether
          // or not anybody looked — which reads as information and is worse
          // than saying nothing. This request is a human choosing the value, so
          // it is the one place that records that somebody did; a null
          // statusSetAt renders as "No status" everywhere instead of an
          // unearned green. Stamped only when `status` is actually in the
          // payload: renaming a project or moving its dates must not
          // retroactively vouch for a status nobody ever set. Creating and
          // duplicating a project leave it null on purpose (the duplicate route
          // copies `status` and not this), so a copy starts out honest.
          ...(data.status !== undefined ? { statusSetAt: new Date() } : {}),
          ...(stageChange ?? {}),
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
          sections: {
            orderBy: { position: "asc" },
          },
        },
      });

      // Board columns bound to a stage of the OLD pipeline would otherwise keep
      // claiming it: no column ever matches the new pipeline, so the
      // "all of X is done, move on?" offer can never fire, and each column's
      // stage picker opens on a value outside its own list. Unbind them; the
      // column and its tasks stay.
      if (typeChanged) {
        const bound = await tx.section.findMany({
          where: { projectId, stage: { not: null } },
          select: { id: true, stage: true },
        });
        const stale = bound
          .filter((sec) => !isStageValidForType(data.type, sec.stage))
          .map((sec) => sec.id);
        if (stale.length > 0) {
          await tx.section.updateMany({
            where: { id: { in: stale } },
            data: { stage: null },
          });
        }
      }

      if (seedEvent) {
        await tx.projectStageEvent.create({
          data: {
            projectId,
            fromStage: seedEvent.fromStage,
            toStage: seedEvent.toStage,
            direction: stageDirection(seedEvent.fromStage, seedEvent.toStage),
            userId,
          },
        });
      }

      return project;
    });

    return NextResponse.json(updatedProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId - Delete project
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    const { projectId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same canonical resolution as PATCH. The inline "owner or project ADMIN"
    // rule this replaced left out workspace managers, so the firm's workspace
    // owner could edit and share a colleague's project but never delete it.
    const access = await getProjectAccess(projectId, userId);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (!access.canManage) {
      return NextResponse.json(
        { error: "You don't have permission to delete this project" },
        { status: 403 }
      );
    }

    // The cascade removes the File / ProjectResource / Attachment /
    // MessageAttachment ROWS but not the blobs behind them, and legacy uploads
    // are public: a deleted job's sealed PDFs stayed downloadable forever by
    // anyone holding a link. Collect the URLs before the rows go.
    const [files, resources, attachments, messageAttachments] =
      await Promise.all([
        prisma.file.findMany({ where: { projectId }, select: { url: true } }),
        prisma.projectResource.findMany({
          where: { projectId },
          select: { url: true },
        }),
        prisma.attachment.findMany({
          where: {
            OR: [
              { task: { projectId } },
              { comment: { task: { projectId } } },
            ],
          },
          select: { url: true },
        }),
        prisma.messageAttachment.findMany({
          where: { message: { projectId } },
          select: { url: true },
        }),
      ]);
    const blobUrls = [
      ...new Set(
        [...files, ...resources, ...attachments, ...messageAttachments].map(
          (r) => r.url
        )
      ),
    ];

    // Public-form and tracking-reply blobs (forms/<formId>/..., tracking/
    // <submissionId>/...) are also linked from a FormSubmission's JSON answers,
    // which no count below can see. This project's own forms and their
    // submissions cascade with it, so their blobs go too; a submission blob
    // owned by ANOTHER project's form (its task was moved in here) stays,
    // because that inbox and tracking page still link to it.
    const ownForms = await prisma.form.findMany({
      where: { projectId },
      select: { id: true, submissions: { select: { id: true } } },
    });
    const ownFormIds = new Set(ownForms.map((f) => f.id));
    const ownSubmissionIds = new Set(
      ownForms.flatMap((f) => f.submissions.map((s) => s.id))
    );
    const isForeignSubmissionBlob = (url: string): boolean => {
      const owner = submissionBlobOwner(url);
      if (!owner) return false;
      return owner.folder === "forms"
        ? !ownFormIds.has(owner.id)
        : !ownSubmissionIds.has(owner.id);
    };

    // The project's custom-field columns. Definitions are workspace-level and
    // the cascade only removes the project's LINKS to them, so a definition
    // made for this project would linger forever with nothing pointing at it.
    const linkedFields = await prisma.projectCustomField.findMany({
      where: { projectId },
      select: { fieldId: true },
    });

    // Goals fed by this project: linked to it directly (the PROJECTS
    // denominator) or to one of its tasks (TASKS / key-result task links).
    // The join rows cascade with the delete, so collect the ids first.
    const [objectiveProjects, objectiveTasks, keyResultTasks] =
      await Promise.all([
        prisma.objectiveProject.findMany({
          where: { projectId },
          select: { objectiveId: true },
        }),
        prisma.objectiveTask.findMany({
          where: { task: { projectId } },
          select: { objectiveId: true },
        }),
        prisma.keyResultTask.findMany({
          where: { task: { projectId } },
          select: { keyResult: { select: { objectiveId: true } } },
        }),
      ]);
    const affectedObjectiveIds = new Set<string>([
      ...objectiveProjects.map((o) => o.objectiveId),
      ...objectiveTasks.map((o) => o.objectiveId),
      ...keyResultTasks.map((k) => k.keyResult.objectiveId),
    ]);

    await prisma.project.delete({
      where: { id: projectId },
    });

    // Best-effort: a goal whose progress counted this project or its tasks
    // would otherwise keep the stale percentage until something else touches it.
    for (const objectiveId of affectedObjectiveIds) {
      try {
        await GoalProgressService.recalculateProgress(objectiveId);
      } catch (e) {
        console.error("[project delete] goal recalc failed:", e);
      }
    }

    // Best-effort: drop only the definitions nothing else uses any more — no
    // other project links them and no task (e.g. My Tasks) holds a value.
    // A definition that was linked to a project is never a personal My Tasks
    // field: those are created unlinked and nothing ever links them.
    if (linkedFields.length > 0) {
      await prisma.customFieldDefinition
        .deleteMany({
          where: {
            id: { in: [...new Set(linkedFields.map((f) => f.fieldId))] },
            projectFields: { none: {} },
            values: { none: {} },
          },
        })
        .catch((err) => {
          console.error("[project delete] custom field cleanup failed:", err);
        });
    }

    // Notifications about this project would otherwise open a not-found page.
    await prisma.notification
      .deleteMany({
        where: { data: { path: ["projectId"], equals: projectId } },
      })
      .catch((err) => {
        console.error("[project delete] notification cleanup failed:", err);
      });

    // Best-effort, after the rows are gone: a blob failure must not turn a
    // completed delete into an error. A URL still referenced elsewhere (a
    // duplicated project copies its resource links) is left alone.
    await Promise.allSettled(
      blobUrls.map(async (url) => {
        if (isForeignSubmissionBlob(url)) return;
        const stillUsed =
          (await prisma.file.count({ where: { url } })) +
          (await prisma.projectResource.count({ where: { url } })) +
          (await prisma.attachment.count({ where: { url } })) +
          (await prisma.messageAttachment.count({ where: { url } }));
        if (stillUsed === 0) await deleteFile(url);
      })
    ).then((results) => {
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.error(
          `[project delete] ${failed} of ${blobUrls.length} blob deletions failed for ${projectId}`
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
