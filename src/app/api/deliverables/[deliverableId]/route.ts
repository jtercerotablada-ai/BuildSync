import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJson } from "@/lib/http";
import { deleteFile } from "@/lib/storage";
import {
  DELETE_BLOCKING_EVENTS,
  NUMBER_MAX_LENGTH,
  isDocType,
  isRevisionLocked,
  isValidStatus,
  manualStatuses,
  normalizeCode,
  statusAfterSealRequiredChange,
  statusLabel,
  type DeliverableKind,
} from "@/lib/deliverables";
import { getDeliverableAccess, isAssignableUser } from "@/lib/deliverable-access";
import { loadDetailJSON, loadRowJSON } from "@/lib/deliverable-serialize";
import {
  DeliverableHttpError,
  WRITE_DENIED,
  dateOnlyInput,
  deliverableErrorResponse,
  isUniqueViolation,
  notFoundResponse,
  optionalText,
  requireCaller,
  staleResponse,
} from "@/lib/deliverable-http";

type Params = { params: Promise<{ deliverableId: string }> };

/** GET /api/deliverables/:id → { item: Detail, permissions } */
export async function GET(_req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();

    const item = await loadDetailJSON(deliverableId);
    if (!item) return notFoundResponse();
    return NextResponse.json({
      item,
      permissions: {
        canWrite: acc.canWrite,
        canSeal: acc.canSeal,
        canMoveStage: acc.canMoveStage,
        isWorkspaceOwner: acc.isWorkspaceOwner,
        // OWNER/ADMIN: may undo someone else's issue or review.
        isWorkspaceManager: acc.isWorkspaceManager,
      },
    });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to load deliverable");
  }
}

const patchSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Enter a title.").max(200, "The title is too long."))
    .optional(),
  number: z
    .string()
    .transform((s) => normalizeCode(s))
    .pipe(
      z
        .string()
        .min(1, "Enter a number.")
        .max(NUMBER_MAX_LENGTH, "The number is too long.")
    )
    .optional(),
  docType: z.string().optional(),
  description: optionalText(10000, "The description").optional(),
  dueDate: dateOnlyInput.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  party: optionalText(200, "The party").optional(),
  receivedAt: dateOnlyInput.optional(),
  sealRequired: z.boolean().optional(),
  status: z.string().optional(),
});

/**
 * PATCH /api/deliverables/:id — edit fields and make a MANUAL status move.
 * Only statuses in manualStatuses() are accepted; seal/issue/review/answer
 * go through /actions. → 200 Row
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) {
      return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });
    }

    const data = patchSchema.parse(await readJson(req));

    const current = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        kind: true,
        status: true,
        sealRequired: true,
        projectId: true,
        revisions: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { sealedAt: true, issuedAt: true, reviewedAt: true, disposition: true },
        },
      },
    });
    if (!current) return notFoundResponse();
    const kind = current.kind as DeliverableKind;

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.number !== undefined) patch.number = data.number;
    if (data.description !== undefined) patch.description = data.description;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
    if (data.party !== undefined) patch.party = data.party;
    if (data.receivedAt !== undefined) patch.receivedAt = data.receivedAt;
    if (data.docType !== undefined) {
      if (kind !== "DOCUMENT") {
        throw new DeliverableHttpError(400, "Only documents have a type.");
      }
      if (!isDocType(data.docType)) {
        throw new DeliverableHttpError(400, "Choose a document type.");
      }
      patch.docType = data.docType;
    }
    if (data.assigneeId !== undefined) {
      if (data.assigneeId && !(await isAssignableUser(current.projectId, data.assigneeId))) {
        throw new DeliverableHttpError(400, "Assignee is not in this workspace");
      }
      patch.assigneeId = data.assigneeId;
    }

    // ── Status ────────────────────────────────────────────────────────────
    let toStatus = current.status;
    if (data.status !== undefined && data.status !== current.status) {
      if (!isValidStatus(kind, data.status)) {
        throw new DeliverableHttpError(400, "Unknown status.");
      }
      const allowed = manualStatuses(kind, current.status, {
        latestRevision: current.revisions[0] ?? null,
      });
      if (!allowed.includes(data.status)) {
        throw new DeliverableHttpError(
          400,
          `${statusLabel(kind, data.status)} is set by its action, not by hand.`
        );
      }
      toStatus = data.status;
    }
    if (data.sealRequired !== undefined && data.sealRequired !== current.sealRequired) {
      if (kind !== "DOCUMENT") {
        throw new DeliverableHttpError(400, "Only documents carry a seal requirement.");
      }
      patch.sealRequired = data.sealRequired;
      toStatus = statusAfterSealRequiredChange(
        toStatus,
        current.sealRequired,
        data.sealRequired
      );
    }
    const statusChanged = toStatus !== current.status;

    try {
      const ok = await prisma.$transaction(async (tx) => {
        const res = await tx.deliverable.updateMany({
          where: statusChanged
            ? { id: deliverableId, status: current.status }
            : { id: deliverableId },
          data: {
            ...patch,
            ...(statusChanged ? { status: toStatus, statusChangedAt: new Date() } : {}),
          },
        });
        if (res.count === 0) return false;
        if (statusChanged) {
          const reopened =
            kind === "RFI" && current.status === "ANSWERED" && toStatus === "OPEN";
          await tx.deliverableEvent.create({
            data: {
              deliverableId,
              type: reopened ? "REOPENED" : "STATUS",
              fromStatus: current.status,
              toStatus,
              actorId: caller.id,
              actorName: caller.actorName,
            },
          });
        }
        return true;
      });
      if (!ok) return staleResponse();
    } catch (err) {
      if (isUniqueViolation(err) && data.number) {
        throw new DeliverableHttpError(409, `${data.number} is already used on this project.`);
      }
      throw err;
    }

    const row = await loadRowJSON(deliverableId);
    if (!row) return notFoundResponse();
    return NextResponse.json(row);
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to update deliverable");
  }
}

/**
 * DELETE /api/deliverables/:id — only a record nothing was ever attested on.
 * A locked revision, an RFI answered even once, or any SEALED/ISSUED/REVIEWED
 * event (a seal later revoked still counts) → 409, use Void instead.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) {
      return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });
    }

    // Check and delete in one transaction with the item row locked. Every
    // action (seal, issue, review, answer) updates that row first, so none
    // can commit between the check and the delete; the re-read after the
    // lock sees anything that committed before it.
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Deliverable" WHERE "id" = ${deliverableId} FOR UPDATE`;
      if (locked.length === 0) return { kind: "missing" as const };

      const [item, blocking, files] = await Promise.all([
        tx.deliverable.findUnique({
          where: { id: deliverableId },
          select: {
            respondedAt: true,
            revisions: { select: { sealedAt: true, issuedAt: true, reviewedAt: true } },
          },
        }),
        tx.deliverableEvent.count({
          where: { deliverableId, type: { in: [...DELETE_BLOCKING_EVENTS] } },
        }),
        tx.deliverableFile.findMany({
          where: { deliverableId },
          select: { url: true },
        }),
      ]);
      if (!item) return { kind: "missing" as const };

      if (
        item.respondedAt != null ||
        blocking > 0 ||
        item.revisions.some((r) => isRevisionLocked(r))
      ) {
        return { kind: "blocked" as const };
      }

      await tx.deliverable.delete({ where: { id: deliverableId } });
      return { kind: "deleted" as const, files };
    });
    if (outcome.kind === "missing") return notFoundResponse();
    if (outcome.kind === "blocked") {
      return NextResponse.json(
        {
          error:
            "Issued and sealed records can't be deleted. Set the status to Void instead.",
        },
        { status: 409 }
      );
    }
    const files = outcome.files;

    // Best effort, after the rows are gone: a failed blob delete leaves an
    // unreferenced (unguessable) blob, never a row pointing at nothing.
    await Promise.all(
      files.map((f) =>
        deleteFile(f.url).catch((err) =>
          console.error("[deliverables DELETE] blob cleanup failed:", err)
        )
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to delete deliverable");
  }
}
