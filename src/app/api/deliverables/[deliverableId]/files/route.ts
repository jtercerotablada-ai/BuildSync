import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJson } from "@/lib/http";
import {
  deleteFile,
  uploadAccessFor,
  uploadFile,
  uploadFolderFor,
  uploadMaxBytesFor,
  verifyUploadedBlob,
  type UploadTarget,
} from "@/lib/storage";
import { isRevisionLocked, type DeliverableKind } from "@/lib/deliverables";
import { getDeliverableAccess } from "@/lib/deliverable-access";
import { deliverableFileSelect, toFileJSON } from "@/lib/deliverable-serialize";
import {
  DeliverableHttpError,
  WRITE_DENIED,
  deliverableErrorResponse,
  notFoundResponse,
  requireCaller,
} from "@/lib/deliverable-http";

type Params = { params: Promise<{ deliverableId: string }> };

const jsonSchema = z.object({
  blobUrl: z.string().min(1).max(2048),
  name: z.string().trim().min(1, "Enter a file name.").max(255, "The file name is too long."),
  revisionId: z.string().min(1).nullable().optional(),
});

const LOCKED_MESSAGE =
  "This revision is locked. Start a new revision to change its files.";

/**
 * Where a file for this deliverable may go: a revision of THIS deliverable
 * that is not locked (documents, submittals), or the item itself (RFIs only).
 * Throws the refusal; returns the revision id to record (or null).
 */
async function resolveFileTarget(
  deliverableId: string,
  kind: DeliverableKind,
  revisionId: string | null | undefined
): Promise<string | null> {
  if (kind === "RFI") {
    if (revisionId) throw new DeliverableHttpError(400, "RFIs don't have revisions.");
    return null;
  }
  if (!revisionId) throw new DeliverableHttpError(400, "Choose the revision.");
  const rev = await prisma.deliverableRevision.findFirst({
    where: { id: revisionId, deliverableId },
    select: { id: true, sealedAt: true, issuedAt: true, reviewedAt: true },
  });
  if (!rev) throw new DeliverableHttpError(404, "Revision not found");
  if (isRevisionLocked(rev)) throw new DeliverableHttpError(409, LOCKED_MESSAGE);
  return rev.id;
}

type FileRowData = {
  deliverableId: string;
  revisionId: string | null;
  uploaderId: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

/**
 * Insert the file row. For a revision file the revision row is locked
 * (FOR UPDATE) and re-checked in the same transaction, so a seal / issue /
 * review landing after resolveFileTarget() either waits for this insert or
 * makes it fail with 409 — a locked revision never gains a file.
 *
 * The Deliverable row is locked FIRST, in the same order the item DELETE
 * takes its locks (deliverable, then its children). Locking only the
 * revision here and then letting the insert's foreign-key check take a share
 * lock on the deliverable is the opposite order, and the two transactions
 * could deadlock each other.
 */
async function createFileRow(data: FileRowData) {
  const revisionId = data.revisionId;
  if (!revisionId) {
    return prisma.deliverableFile.create({ data, select: deliverableFileSelect });
  }
  return prisma.$transaction(async (tx) => {
    const parent = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Deliverable" WHERE "id" = ${data.deliverableId} FOR UPDATE`;
    if (!parent[0]) throw new DeliverableHttpError(404, "Deliverable not found");
    const rows = await tx.$queryRaw<
      { sealedAt: Date | null; issuedAt: Date | null; reviewedAt: Date | null }[]
    >`SELECT "sealedAt", "issuedAt", "reviewedAt" FROM "DeliverableRevision"
      WHERE "id" = ${revisionId} AND "deliverableId" = ${data.deliverableId}
      FOR UPDATE`;
    const rev = rows[0];
    if (!rev) throw new DeliverableHttpError(404, "Revision not found");
    if (isRevisionLocked(rev)) throw new DeliverableHttpError(409, LOCKED_MESSAGE);
    return tx.deliverableFile.create({ data, select: deliverableFileSelect });
  });
}

/**
 * POST /api/deliverables/:id/files
 *   JSON      { blobUrl, name, revisionId | null } — after uploadDirect() with
 *             target { kind: "deliverable-file", deliverableId }
 *   multipart { file, revisionId } — small files only (~4.5MB request cap)
 * → 201 DeliverableFileJSON
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
    const target: UploadTarget = { kind: "deliverable-file", deliverableId };
    const contentType = req.headers.get("content-type") || "";

    // ── Already in the store (direct upload) ─────────────────────────────
    if (contentType.includes("application/json")) {
      const data = jsonSchema.parse(await readJson(req));

      // Guard 1: our store, the expected access, THIS deliverable's folder;
      // size and type from the stored blob. Throws BlobRejectedError — and a
      // blob refused here is not ours to delete.
      const verified = await verifyUploadedBlob(
        data.blobUrl,
        data.name,
        uploadFolderFor(target),
        uploadAccessFor(target),
        uploadMaxBytesFor(target)
      );

      // One row per blob. A url already recorded is in use: refuse, and do
      // NOT delete it.
      const already = await prisma.deliverableFile.findFirst({
        where: { url: verified.url },
        select: { id: true },
      });
      if (already) {
        return NextResponse.json({ error: "That file is already attached" }, { status: 409 });
      }

      // From here on the blob is proven to be an unrecorded upload into this
      // deliverable's folder, so every refusal deletes it — a public blob
      // nobody points at is still bytes at a URL.
      let revisionId: string | null;
      try {
        revisionId = await resolveFileTarget(deliverableId, kind, data.revisionId);
      } catch (err) {
        await deleteFile(verified.url).catch((e) =>
          console.error("[deliverable files POST] orphan blob cleanup failed:", e)
        );
        throw err;
      }

      try {
        const file = await createFileRow({
          deliverableId,
          revisionId,
          uploaderId: caller.id,
          name: verified.name,
          url: verified.url,
          size: verified.size,
          mimeType: verified.mimeType,
        });
        return NextResponse.json(toFileJSON(file), { status: 201 });
      } catch (err) {
        await deleteFile(verified.url).catch((e) =>
          console.error("[deliverable files POST] orphan blob cleanup failed:", e)
        );
        throw err;
      }
    }

    // ── Multipart fallback ───────────────────────────────────────────────
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const rawRev = form.get("revisionId");
    const revisionId = await resolveFileTarget(
      deliverableId,
      kind,
      typeof rawRev === "string" && rawRev ? rawRev : null
    );

    let url: string;
    try {
      // uploadFile appends "/<uuid>/<name>" itself, so the folder goes in
      // without its trailing slash (same as the resources route).
      ({ url } = await uploadFile(file, uploadFolderFor(target).replace(/\/$/, "")));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 400 }
      );
    }

    try {
      const row = await createFileRow({
        deliverableId,
        revisionId,
        uploaderId: caller.id,
        name: file.name.slice(0, 255),
        url,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      });
      return NextResponse.json(toFileJSON(row), { status: 201 });
    } catch (err) {
      await deleteFile(url).catch((e) =>
        console.error("[deliverable files POST] orphan blob cleanup failed:", e)
      );
      throw err;
    }
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to attach file");
  }
}
