import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJson } from "@/lib/http";
import {
  REVISION_LABEL_PATTERN,
  isRevisionLocked,
  nextRevisionLabel,
  normalizeCode,
  type DeliverableKind,
} from "@/lib/deliverables";
import { getDeliverableAccess } from "@/lib/deliverable-access";
import { loadRevisionJSON } from "@/lib/deliverable-serialize";
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

const createSchema = z.object({
  // Absent → the next label after the current one; null → refused (the
  // client has to type one when there is no obvious successor).
  label: z
    .string()
    .trim()
    .regex(REVISION_LABEL_PATTERN, "Use up to 12 letters, digits, dots or dashes.")
    .nullable()
    .optional(),
  notes: optionalText(5000, "The notes").optional(),
  receivedAt: dateOnlyInput.optional(),
});

/**
 * POST /api/deliverables/:id/revisions — start the next revision (documents)
 * or log a resubmittal cycle (submittals). Only once the current revision is
 * locked (sealed, issued or reviewed). → 201 RevisionJSON
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });

    const kind = acc.deliverable.kind as DeliverableKind;
    if (kind === "RFI") {
      throw new DeliverableHttpError(400, "RFIs don't have revisions.");
    }

    const data = createSchema.parse(await readJson(req));

    const item = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        status: true,
        revisions: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: {
            label: true,
            sequence: true,
            sealedAt: true,
            issuedAt: true,
            reviewedAt: true,
          },
        },
      },
    });
    if (!item) return notFoundResponse();
    if (item.status === "VOID") {
      throw new DeliverableHttpError(409, "Restore it from Void before starting a new revision.");
    }
    const latest = item.revisions[0] ?? null;

    let label: string | null;
    if (data.label === undefined) {
      label = nextRevisionLabel(latest?.label ?? null);
    } else {
      label = data.label ? normalizeCode(data.label) : null;
    }
    if (!label) throw new DeliverableHttpError(400, "Enter a revision label.");

    if (latest && !isRevisionLocked(latest)) {
      throw new DeliverableHttpError(
        409,
        `Rev ${latest.label} hasn't been sealed, issued or reviewed yet. Add files to it instead of starting Rev ${label}.`
      );
    }

    const toStatus = kind === "DOCUMENT" ? "IN_PROGRESS" : "UNDER_REVIEW";
    const statusChanged = toStatus !== item.status;

    let revisionId: string | null;
    try {
      revisionId = await prisma.$transaction(async (tx) => {
        const res = await tx.deliverable.updateMany({
          where: { id: deliverableId, status: item.status },
          data: {
            status: toStatus,
            ...(statusChanged ? { statusChangedAt: new Date() } : {}),
          },
        });
        if (res.count === 0) return null;
        const rev = await tx.deliverableRevision.create({
          data: {
            deliverableId,
            sequence: (latest?.sequence ?? 0) + 1,
            label: label!,
            notes: data.notes ?? null,
            receivedAt: kind === "SUBMITTAL" ? data.receivedAt ?? null : null,
            createdById: caller.id,
          },
          select: { id: true },
        });
        await tx.deliverableEvent.create({
          data: {
            deliverableId,
            revisionId: rev.id,
            type: "REVISION_ADDED",
            fromStatus: item.status,
            toStatus,
            note: `Rev ${label}`,
            actorId: caller.id,
            actorName: caller.actorName,
          },
        });
        return rev.id;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DeliverableHttpError(409, `Rev ${label} already exists.`);
      }
      throw err;
    }
    if (!revisionId) return staleResponse();

    const json = await loadRevisionJSON(deliverableId, revisionId);
    return NextResponse.json(json, { status: 201 });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to start revision");
  }
}
