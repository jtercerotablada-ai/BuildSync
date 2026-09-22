import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJson } from "@/lib/http";
import { deleteFile } from "@/lib/storage";
import {
  REVISION_LABEL_PATTERN,
  isRevisionLocked,
  normalizeCode,
  statusAfterRevisionDelete,
  type DeliverableKind,
} from "@/lib/deliverables";
import { getDeliverableAccess } from "@/lib/deliverable-access";
import { loadRevisionJSON, loadRowJSON } from "@/lib/deliverable-serialize";
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

type Params = { params: Promise<{ deliverableId: string; revisionId: string }> };

const patchSchema = z.object({
  label: z
    .string()
    .trim()
    .regex(REVISION_LABEL_PATTERN, "Use up to 12 letters, digits, dots or dashes.")
    .optional(),
  notes: optionalText(5000, "The notes").optional(),
  receivedAt: dateOnlyInput.optional(),
});

/**
 * PATCH /api/deliverables/:id/revisions/:revisionId — rename / annotate a
 * revision. Once locked only `notes` may change. → 200 RevisionJSON
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId, revisionId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });

    const rev = await prisma.deliverableRevision.findFirst({
      where: { id: revisionId, deliverableId },
      select: { id: true, label: true, sealedAt: true, issuedAt: true, reviewedAt: true },
    });
    if (!rev) return notFoundResponse("Revision");

    const data = patchSchema.parse(await readJson(req));
    const label = data.label !== undefined ? normalizeCode(data.label) : undefined;

    const touchesLocked =
      (label !== undefined && label !== rev.label) || data.receivedAt !== undefined;
    if (isRevisionLocked(rev) && touchesLocked) {
      throw new DeliverableHttpError(409, "This revision is locked.");
    }

    try {
      // A label / received-date change is guarded on the revision still being
      // unlocked: a seal or issue landing between the read and the write must
      // not end up describing a revision that was renamed after the fact.
      const res = await prisma.deliverableRevision.updateMany({
        where: {
          id: rev.id,
          deliverableId,
          ...(touchesLocked ? { sealedAt: null, issuedAt: null, reviewedAt: null } : {}),
        },
        data: {
          ...(label !== undefined ? { label } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          ...(data.receivedAt !== undefined ? { receivedAt: data.receivedAt } : {}),
        },
      });
      if (res.count === 0) {
        if (touchesLocked) throw new DeliverableHttpError(409, "This revision is locked.");
        return notFoundResponse("Revision");
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DeliverableHttpError(409, `Rev ${label} already exists.`);
      }
      throw err;
    }

    const json = await loadRevisionJSON(deliverableId, rev.id);
    return NextResponse.json(json);
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to update revision");
  }
}

/**
 * DELETE /api/deliverables/:id/revisions/:revisionId — undo "New revision":
 * only the latest, unlocked, and never the only one. The item's status is
 * re-derived from the revision that becomes current (a Void item stays
 * Void). → 200 { ok: true, item: Row }
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId, revisionId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });

    const rev = await prisma.deliverableRevision.findFirst({
      where: { id: revisionId, deliverableId },
      select: { id: true, label: true, sealedAt: true, issuedAt: true, reviewedAt: true },
    });
    if (!rev) return notFoundResponse("Revision");

    const item = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        kind: true,
        status: true,
        revisions: {
          orderBy: { sequence: "desc" },
          take: 2,
          select: { id: true, sealedAt: true, issuedAt: true, reviewedAt: true, disposition: true },
        },
      },
    });
    if (!item) return notFoundResponse();
    const [latest, previous] = item.revisions;

    if (!latest || latest.id !== rev.id) {
      throw new DeliverableHttpError(409, "Only the latest revision can be deleted.");
    }
    if (isRevisionLocked(rev)) {
      throw new DeliverableHttpError(409, "This revision is locked.");
    }
    if (!previous) {
      throw new DeliverableHttpError(409, "The only revision can't be deleted.");
    }

    const kind = item.kind as DeliverableKind;
    const toStatus =
      item.status === "VOID" ? "VOID" : statusAfterRevisionDelete(kind, previous);
    const statusChanged = toStatus !== item.status;

    const files = await prisma.deliverableFile.findMany({
      where: { deliverableId, revisionId: rev.id },
      select: { url: true },
    });

    const ok = await prisma.$transaction(async (tx) => {
      const res = await tx.deliverable.updateMany({
        where: { id: deliverableId, status: item.status },
        data: {
          status: toStatus,
          ...(statusChanged ? { statusChangedAt: new Date() } : {}),
        },
      });
      if (res.count === 0) return false;
      // Guarded too: a seal or issue landing between the read and here must
      // not be deleted along with the revision.
      const del = await tx.deliverableRevision.deleteMany({
        where: {
          id: rev.id,
          deliverableId,
          sealedAt: null,
          issuedAt: null,
          reviewedAt: null,
        },
      });
      if (del.count === 0) throw new StaleError();
      await tx.deliverableEvent.create({
        data: {
          deliverableId,
          type: "REVISION_DELETED",
          fromStatus: item.status,
          toStatus,
          note: `Rev ${rev.label}`,
          actorId: caller.id,
          actorName: caller.actorName,
        },
      });
      return true;
    }).catch((err) => {
      if (err instanceof StaleError) return false;
      throw err;
    });
    if (!ok) return staleResponse();

    await Promise.all(
      files.map((f) =>
        deleteFile(f.url).catch((err) =>
          console.error("[deliverable revision DELETE] blob cleanup failed:", err)
        )
      )
    );

    const row = await loadRowJSON(deliverableId);
    return NextResponse.json({ ok: true, item: row });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to delete revision");
  }
}

class StaleError extends Error {}
