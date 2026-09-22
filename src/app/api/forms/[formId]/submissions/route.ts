import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveProjectAccess } from "@/lib/project-access";
import { isVercelBlobUrl } from "@/lib/storage";
import { signTrackingToken, buildTrackingUrl } from "@/lib/tracking-token";
import {
  type FormField,
  type FormSubmissionPayload,
  neutralizeStoredAnswers,
} from "@/lib/form-types";

/**
 * GET /api/forms/:formId/submissions[?cursor=<submissionId>]
 *
 * Lists submissions for a form, newest first, one page at a time —
 * auth-gated to anyone who can read the parent project and still holds a
 * contributor seat in its workspace. Returns the answer payload + the
 * auto-created task id so the UI can link to the task in the project, plus
 * the total so the inbox can say how many older ones remain.
 *
 * GET /api/forms/:formId/submissions?tracking=<submissionId>
 *
 * Issues a fresh tracking link for one submission, so staff can hand it
 * back to a submitter who lost the receipt email.
 */

const PAGE_SIZE = 50;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { formId } = await params;

    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        project: {
          select: {
            id: true,
            ownerId: true,
            visibility: true,
            workspaceId: true,
            teamId: true,
            members: { select: { userId: true, role: true } },
          },
        },
      },
    });
    if (!form) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Submissions carry PII of EXTERNAL submitters. The project read rule
    // decides (so a PRIVATE project's inbox stays with its members), and a
    // contributor seat is required on top: a GUEST explicitly shared on the
    // project, or someone who left the firm, gets nothing. Same rule as the
    // CSV export and the print view. 404 so the form id can't be probed.
    const access = await resolveProjectAccess(form.project, userId);
    if (!access.ok || !access.hasContributorSeat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const trackingFor = url.searchParams.get("tracking");
    if (trackingFor) {
      // The link lets its holder post on the task as the submitter, so a
      // read-only member (VIEWER) must not be able to mint one.
      if (!access.canComment) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const sub = await prisma.formSubmission.findFirst({
        where: { id: trackingFor, formId },
        select: { id: true },
      });
      if (!sub) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const token = signTrackingToken(sub.id);
      return NextResponse.json({
        trackingUrl: buildTrackingUrl(formId, sub.id, token),
      });
    }

    const cursor = url.searchParams.get("cursor");
    const [total, rows] = await Promise.all([
      prisma.formSubmission.count({ where: { formId } }),
      prisma.formSubmission.findMany({
        where: { formId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
    ]);
    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    const fields = (form.fields as unknown as FormField[]) || [];
    return NextResponse.json({
      total,
      nextCursor: hasMore ? page[page.length - 1].id : null,
      submissions: page.map((s) => ({
        id: s.id,
        // Links survive only when they point at our own blob store — a
        // forged {name,url,size} answer must not reach staff as a "file".
        data: neutralizeStoredAnswers(
          fields,
          (s.data as FormSubmissionPayload) || {},
          isVercelBlobUrl
        ),
        taskId: s.taskId,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[submissions GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
