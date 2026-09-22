import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { canReadContactInbox } from "@/lib/contact-inbox";
import { parseContactAttachments } from "@/lib/contact-attachments";
import { deleteFile } from "@/lib/storage";
import { Prisma } from "@prisma/client";

function isRecordNotFound(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

/**
 * ContactSubmission is a GLOBAL table, so this endpoint must gate on the
 * FIRM's workspace, not on the caller's role in whatever workspace they
 * happen to belong to. The previous `findFirst` + role check passed for any
 * self-registered account (onboarding makes every signup the OWNER of their
 * own workspace) and then returned every lead the firm had ever received.
 * See src/lib/contact-inbox.ts.
 */

// GET /api/admin/submissions - List all ContactSubmission records with pagination
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canReadContactInbox(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // Clamp both (house pattern, see /api/notifications). Unclamped they reach
    // Prisma's skip/take raw: NaN is a validation error the generic catch turns
    // into a 500, and a negative page/limit reads from the end of the table.
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      100
    );
    const status = searchParams.get("status"); // NEW, REVIEWED, CONTACTED
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [submissions, total] = await Promise.all([
      prisma.contactSubmission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contactSubmission.count({ where }),
    ]);

    return NextResponse.json({
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/submissions - Update submission status
export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canReadContactInbox(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const status = typeof body?.status === "string" ? body.status : "";

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["NEW", "REVIEWED", "CONTACTED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const submission = await prisma.contactSubmission.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json(submission);
  } catch (error) {
    // A row deleted in another tab is a 404, not a server failure.
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    console.error("Error updating submission:", error);
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/submissions?id=<id> - Remove a submission (spam, tests).
// Its attachments are deleted from blob storage too, so a spam upload does not
// outlive the row that was its only reference.
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canReadContactInbox(userId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const submission = await prisma.contactSubmission.delete({
      where: { id },
      select: { files: true },
    });

    // parseContactAttachments keeps only urls of our own contact folder, and
    // deleteFile ignores anything outside our store. Best effort: the row is
    // already gone, and an orphaned blob is not worth failing the request.
    await Promise.allSettled(
      parseContactAttachments(submission.files).map((f) => deleteFile(f.url))
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    console.error("Error deleting submission:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
