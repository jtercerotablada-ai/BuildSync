import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJson } from "@/lib/http";
import {
  DELIVERABLE_ACTIONS,
  decideDeliverableAction,
  hasPdf,
  utcMidnight,
  type ActionState,
  type DeliverableActionInput,
  type DeliverableKind,
} from "@/lib/deliverables";
import {
  deliverableStageOffer,
  deliverableStageOfferPrompt,
} from "@/lib/stage-advance";
import {
  getDeliverableAccess,
  listSealRequestRecipients,
} from "@/lib/deliverable-access";
import { loadRowJSON } from "@/lib/deliverable-serialize";
import {
  dateOnlyInput,
  deliverableErrorResponse,
  notFoundResponse,
  requireCaller,
  staleResponse,
} from "@/lib/deliverable-http";

type Params = { params: Promise<{ deliverableId: string }> };

const actionSchema = z.object({
  action: z.enum(DELIVERABLE_ACTIONS as [string, ...string[]]),
  revisionId: z.string().min(1).nullable().optional(),
  // REVOKE_SEAL
  reason: z.string().max(500, "The reason is too long.").nullable().optional(),
  // ISSUE
  issuedToParty: z.string().nullable().optional(),
  issuedTo: z.string().max(200, "The recipient name is too long.").nullable().optional(),
  issuedAt: dateOnlyInput.optional(),
  transmittalNote: z
    .string()
    .max(2000, "The transmittal note is too long.")
    .nullable()
    .optional(),
  confirmUnsealed: z.boolean().optional(),
  // REVIEW
  disposition: z.string().nullable().optional(),
  notes: z.string().max(5000, "The notes are too long.").nullable().optional(),
  returnedAt: dateOnlyInput.optional(),
  // ANSWER
  response: z.string().max(10000, "The answer is too long.").nullable().optional(),
  respondedAt: dateOnlyInput.optional(),
});

class StaleError extends Error {}

/**
 * POST /api/deliverables/:id/actions — every state action in one route:
 * REQUEST_SEAL, SEAL, REVOKE_SEAL, ISSUE, UNDO_ISSUE, REVIEW, UNDO_REVIEW,
 * ANSWER. The rules are decideDeliverableAction (@/lib/deliverables); this
 * loads state, applies the decided patch with guarded writes, records the
 * event in the same transaction, and — for REQUEST_SEAL / ISSUE — computes a
 * stage OFFER. It never writes Project.stage or Project.gate.
 *
 * → 200 { item: Row, stageOffer: {from:{key,label}, to:{key,label}, prompt} | null }
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();

    const body = actionSchema.parse(await readJson(req));

    // A revision id from the body is bound to THIS deliverable, or it is a 404.
    if (body.revisionId) {
      const bound = await prisma.deliverableRevision.findFirst({
        where: { id: body.revisionId, deliverableId },
        select: { id: true },
      });
      if (!bound) return notFoundResponse("Revision");
    }

    const item = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        kind: true,
        status: true,
        number: true,
        title: true,
        sealRequired: true,
        party: true,
        response: true,
        respondedAt: true,
        project: { select: { id: true, name: true, type: true, stage: true } },
        revisions: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: {
            id: true,
            label: true,
            sealedAt: true,
            sealedById: true,
            sealedByName: true,
            issuedAt: true,
            issuedById: true,
            issuedToParty: true,
            issuedTo: true,
            transmittalNote: true,
            disposition: true,
            reviewedAt: true,
            reviewedById: true,
            files: { select: { name: true, mimeType: true } },
          },
        },
      },
    });
    if (!item) return notFoundResponse();

    const cur = item.revisions[0] ?? null;
    const state: ActionState = {
      kind: item.kind as DeliverableKind,
      status: item.status,
      sealRequired: item.sealRequired,
      party: item.party,
      response: item.response,
      respondedAt: item.respondedAt,
      currentRevision: cur
        ? {
            id: cur.id,
            label: cur.label,
            fileCount: cur.files.length,
            hasPdf: hasPdf(cur.files),
            sealedAt: cur.sealedAt,
            sealedById: cur.sealedById,
            sealedByName: cur.sealedByName,
            issuedAt: cur.issuedAt,
            issuedById: cur.issuedById,
            issuedToParty: cur.issuedToParty,
            issuedTo: cur.issuedTo,
            transmittalNote: cur.transmittalNote,
            disposition: cur.disposition,
            reviewedAt: cur.reviewedAt,
            reviewedById: cur.reviewedById,
          }
        : null,
    };

    const now = new Date();
    const decision = decideDeliverableAction(
      state,
      body as DeliverableActionInput,
      {
        userId: caller.id,
        actorName: caller.actorName,
        canWrite: acc.canWrite,
        canSeal: acc.canSeal,
        isWorkspaceOwner: acc.isWorkspaceOwner,
        isWorkspaceManager: acc.isWorkspaceManager,
        peLicenseNo: acc.peLicenseNo,
      },
      { now, today: utcMidnight(now) }
    );
    if (!decision.ok) {
      return NextResponse.json(
        decision.code
          ? { error: decision.error, code: decision.code }
          : { error: decision.error },
        { status: decision.status }
      );
    }

    const committed = await prisma
      .$transaction(async (tx) => {
        const res = await tx.deliverable.updateMany({
          where: { id: deliverableId, status: decision.fromStatus },
          data: {
            ...decision.itemPatch,
            status: decision.toStatus,
            ...(decision.statusChanged ? { statusChangedAt: now } : {}),
          },
        });
        if (res.count === 0) throw new StaleError();
        if (decision.revisionPatch && decision.event.revisionId) {
          const r = await tx.deliverableRevision.updateMany({
            where: {
              id: decision.event.revisionId,
              deliverableId,
              ...(decision.revisionGuard ?? {}),
              // The event note names this label ("Rev 0 · PE …"): a rename
              // landing after our read makes the action stale, not wrong.
              ...(cur && cur.id === decision.event.revisionId
                ? { label: cur.label }
                : {}),
            },
            data: decision.revisionPatch,
          });
          if (r.count === 0) throw new StaleError();
        }
        await tx.deliverableEvent.create({
          data: {
            deliverableId,
            revisionId: decision.event.revisionId,
            type: decision.event.type,
            fromStatus: decision.fromStatus,
            toStatus: decision.toStatus,
            note: decision.event.note,
            actorId: caller.id,
            actorName: caller.actorName,
          },
        });
        return true;
      })
      .catch((err) => {
        if (err instanceof StaleError) return false;
        throw err;
      });
    if (!committed) return staleResponse();

    // ── After commit, best effort ─────────────────────────────────────────
    if (body.action === "REQUEST_SEAL" && cur) {
      try {
        const recipients = await listSealRequestRecipients(item.project.id, caller.id);
        if (recipients.length > 0) {
          const me = await prisma.user.findUnique({
            where: { id: caller.id },
            select: { image: true },
          });
          // Deliberately NOT gated by shouldNotify / notifyProjectUpdates:
          // this is a direct ask to the one or two people who can seal, and
          // muting "project updates" must not silently drop it. Recipients are
          // already limited to seal-authorized contributors who can edit this
          // project, so nothing leaks.
          await prisma.notification.createMany({
            data: recipients.map((userId) => ({
              userId,
              type: "STATUS_UPDATE" as const,
              title: `${caller.actorName} requested your seal`,
              message: `${item.number} ${item.title} · Rev ${cur.label} — ${item.project.name}`,
              data: {
                projectId: item.project.id,
                deliverableId,
                view: "deliverables",
                authorName: caller.actorName,
                authorImage: me?.image ?? null,
              },
            })),
          });
        }
      } catch (err) {
        console.error("[deliverable actions] seal-request notification failed:", err);
      }
    }

    let stageOffer: {
      from: { key: string; label: string };
      to: { key: string; label: string };
      prompt: string;
    } | null = null;
    if (decision.stageEvent) {
      const offer = deliverableStageOffer({
        type: item.project.type,
        stage: item.project.stage,
        event: decision.stageEvent.event,
        issuedToParty: decision.stageEvent.issuedToParty ?? null,
        canMoveStage: acc.canMoveStage,
      });
      if (offer) {
        stageOffer = {
          from: { key: offer.from.key, label: offer.from.label },
          to: { key: offer.to.key, label: offer.to.label },
          prompt: deliverableStageOfferPrompt(offer),
        };
      }
    }

    const row = await loadRowJSON(deliverableId);
    return NextResponse.json({ item: row, stageOffer });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to update deliverable");
  }
}
