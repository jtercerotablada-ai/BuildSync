import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
import {
  isStageValidForType,
  legacyGateFor,
  pipelineForType,
  stageDirection,
} from "@/lib/pipelines";

/**
 * PATCH /api/projects/:projectId/stage — move a job to another stage.
 *
 * Its own endpoint rather than another field on the project PATCH, because a
 * stage move is not a field edit: it writes four columns plus a history row
 * that has to agree with them, and the history is the product (days on a desk,
 * how many times a job went back through City Comments). One writer, one
 * transaction, one place to read when a number looks wrong.
 */

// An empty string from a cleared textarea means "no blocker", not "".
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim() || null)
    .nullable()
    .optional();

const moveStageSchema = z.object({
  stage: z.string().min(1),
  // Why the job moved — shown in the history, never required: forcing a note
  // on every move is how a team learns to type "." into the box.
  reason: optionalText(1000),
  // What we are actually waiting on in the NEW stage.
  blocker: optionalText(500),
});

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
    const data = moveStageSchema.parse(body);

    const access = await getProjectAccess(projectId, userId);

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Deliberately the SAME rule as the project PATCH — owner, or a member with
    // ADMIN/EDITOR — spelled the same way. A stage move is an ordinary content
    // edit, and a second, subtly different rule for it is how the two drift.
    const canEdit =
      access.isOwner ||
      access.memberRole === "ADMIN" ||
      access.memberRole === "EDITOR";

    if (!canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to edit this project" },
        { status: 403 }
      );
    }

    const current = await prisma.project.findUnique({
      where: { id: projectId },
      select: { type: true, stage: true, stageEnteredAt: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!isStageValidForType(current.type, data.stage)) {
      const pipeline = pipelineForType(current.type);
      return NextResponse.json(
        {
          error: pipeline
            ? `"${data.stage}" is not a stage of the ${pipeline.label} pipeline.`
            : "This project has no type, so it has no pipeline. Set a project type before setting a stage.",
        },
        { status: 400 }
      );
    }

    const isMove = data.stage !== current.stage;
    const enteredAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Guarded on the stage we read: two people moving the same job from two
      // tabs would otherwise both write their own `fromStage`, and the history
      // would show a move that never happened. Nothing is written when the
      // stage has already changed underneath us.
      const written = await tx.project.updateMany({
        where: { id: projectId, stage: current.stage },
        data: {
          stage: data.stage,
          // THE CLOCK. Re-saving the same stage must not reset it — "24 days on
          // the client's desk" is the number the firm acts on, and quietly
          // restarting it makes the whole feature a lie. It is still set when
          // the column is null, because the backfill seeded a stage without one
          // and a clock that has never started is not a clock being reset.
          ...(isMove || current.stageEnteredAt === null
            ? { stageEnteredAt: enteredAt }
            : {}),
          // A blocker describes the stage it was written in, so a move drops it
          // unless this request carries a new one. Staying put leaves it alone.
          ...(data.blocker !== undefined
            ? { stageBlocker: data.blocker }
            : isMove
              ? { stageBlocker: null }
              : {}),
          // Derived here and nowhere else — see legacyGateFor().
          gate: legacyGateFor(data.stage),
        },
      });

      if (written.count === 0) return null;

      // No move, no history row: a re-save of the same stage (editing the
      // blocker) is not a trip through the pipeline, and counting it would
      // inflate every number the history exists to produce.
      const event = isMove
        ? await tx.projectStageEvent.create({
            data: {
              projectId,
              fromStage: current.stage,
              toStage: data.stage,
              direction: stageDirection(current.stage, data.stage),
              reason: data.reason ?? null,
              userId,
            },
            select: {
              id: true,
              fromStage: true,
              toStage: true,
              direction: true,
              reason: true,
              createdAt: true,
            },
          })
        : null;

      const project = await tx.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          type: true,
          stage: true,
          stageEnteredAt: true,
          stageBlocker: true,
          gate: true,
          updatedAt: true,
        },
      });

      return { project, event };
    });

    if (!result || !result.project) {
      return NextResponse.json(
        {
          error:
            "This project's stage changed somewhere else. Reload and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ...result.project, event: result.event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return NextResponse.json(
        { error: zodError.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }

    console.error("Error moving project stage:", error);
    return NextResponse.json(
      { error: "Failed to move project stage" },
      { status: 500 }
    );
  }
}
