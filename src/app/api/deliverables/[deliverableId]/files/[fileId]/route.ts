import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";
import { isRevisionLocked } from "@/lib/deliverables";
import { getDeliverableAccess } from "@/lib/deliverable-access";
import {
  WRITE_DENIED,
  deliverableErrorResponse,
  notFoundResponse,
  requireCaller,
} from "@/lib/deliverable-http";

type Params = { params: Promise<{ deliverableId: string; fileId: string }> };

/**
 * DELETE /api/deliverables/:id/files/:fileId — remove a file from a revision
 * that is not locked (or an RFI attachment). → 200 { ok: true }
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { deliverableId, fileId } = await params;

    const acc = await getDeliverableAccess(deliverableId, caller.id);
    if (!acc.ok) return notFoundResponse();
    if (!acc.canWrite) return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });

    const file = await prisma.deliverableFile.findFirst({
      where: { id: fileId, deliverableId },
      select: {
        id: true,
        url: true,
        revision: { select: { sealedAt: true, issuedAt: true, reviewedAt: true } },
      },
    });
    if (!file) return notFoundResponse("File");
    if (file.revision && isRevisionLocked(file.revision)) {
      return NextResponse.json(
        { error: "This revision is locked. Start a new revision to change its files." },
        { status: 409 }
      );
    }

    // Guarded on the revision still being unlocked: a seal landing between
    // the read and the delete must freeze the file, not lose it.
    const res = await prisma.deliverableFile.deleteMany({
      where: {
        id: file.id,
        deliverableId,
        OR: [
          { revisionId: null },
          { revision: { sealedAt: null, issuedAt: null, reviewedAt: null } },
        ],
      },
    });
    if (res.count === 0) {
      return NextResponse.json(
        { error: "This revision is locked. Start a new revision to change its files." },
        { status: 409 }
      );
    }

    await deleteFile(file.url).catch((err) =>
      console.error("[deliverable file DELETE] blob cleanup failed:", err)
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to delete file");
  }
}
