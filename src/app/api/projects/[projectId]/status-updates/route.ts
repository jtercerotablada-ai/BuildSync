import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { shouldNotify } from "@/lib/notification-prefs";

const STATUS_VALUES = [
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "ON_HOLD",
  "COMPLETE",
] as const;

// Status Builder section types — same shape used by the composer.
// CUSTOM allows future "add block" UX without another migration.
const SECTION_TYPES = [
  "SUMMARY",
  "ACCOMPLISHED",
  "BLOCKED",
  "NEXT_STEPS",
  "CUSTOM",
] as const;

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(SECTION_TYPES),
  label: z.string().min(1).max(120),
  content: z.string().max(4000).default(""),
});

const createSchema = z.object({
  status: z.enum(STATUS_VALUES),
  // Optional — the block-builder composer sends `sections`; the
  // legacy single-textarea path sends `summary` directly. Either
  // satisfies the "must have content" check below.
  summary: z.string().max(4000).optional(),
  sections: z.array(sectionSchema).max(20).optional(),
  // When true we also patch the project itself so the cockpit-wide
  // status badge stays in sync. Front-end posts this every time —
  // PMs expect the "Update status" action to drive the badge.
  syncProjectStatus: z.boolean().optional().default(true),
});

type SectionInput = z.infer<typeof sectionSchema>;

/**
 * Render the structured sections into a single plaintext summary
 * we store on `StatusUpdate.summary`. Keeps list views (home widget,
 * /api/status-updates, etc.) able to show a quick preview without
 * needing to parse `sections`.
 *
 * Format: each section becomes "LABEL:\ncontent\n" with blank lines
 * between. Empty sections are skipped so the preview doesn't carry
 * dead headers.
 */
function renderSectionsToSummary(sections: SectionInput[]): string {
  const blocks: string[] = [];
  for (const s of sections) {
    const c = s.content.trim();
    if (!c) continue;
    blocks.push(`${s.label.toUpperCase()}:\n${c}`);
  }
  return blocks.join("\n\n");
}

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      visibility: true,
      workspaceId: true,
      members: { select: { userId: true, role: true } },
    },
  });

  if (!project) return { ok: false as const, status: 404 };

  const member = project.members.find((m) => m.userId === userId) ?? null;
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  if (isOwner || isMember || project.visibility === "PUBLIC") {
    return { ok: true as const, project, member };
  }

  if (project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) return { ok: true as const, project, member: null };
  }

  return { ok: false as const, status: 403 };
}

// Mirrors the role gate in /api/projects/[id] PATCH: only the owner,
// an ADMIN, or an EDITOR can change the live project.status. Anyone
// with read access can still post a status-update record — they just
// can't drive the cockpit-wide badge.
function canEditProject(
  project: { ownerId: string | null },
  member: { role: string } | null,
  userId: string
): boolean {
  if (project.ownerId === userId) return true;
  if (!member) return false;
  return member.role === "ADMIN" || member.role === "EDITOR";
}

// GET /api/projects/:projectId/status-updates
// Returns history of status updates for this project, newest first.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const updates = await prisma.statusUpdate.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const authorIds = [
      ...new Set(updates.map((u) => u.authorId).filter(Boolean)),
    ] as string[];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, name: true, email: true, image: true },
        })
      : [];
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    const mapped = updates.map((u) => {
      const a = u.authorId ? authorMap.get(u.authorId) : null;
      return {
        id: u.id,
        status: u.status,
        summary: u.summary,
        // Structured blocks for the block-builder renderer. Null on
        // pre-builder rows — clients fall back to `summary`.
        sections: u.sections ?? null,
        createdAt: u.createdAt.toISOString(),
        author: a
          ? { id: a.id, name: a.name, email: a.email, image: a.image }
          : null,
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    console.error("[project status-updates GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch status updates" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/status-updates
// Posts a new status update + optionally syncs Project.status.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const access = await assertProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Resolve final summary + sections from either composer path:
    //   block-builder → sections array → renderSectionsToSummary
    //   legacy single-textarea → summary string (sections null)
    // At least one of the two must carry actual content.
    let finalSummary = (parsed.data.summary ?? "").trim();
    let finalSections: SectionInput[] | null = null;
    if (parsed.data.sections && parsed.data.sections.length > 0) {
      // Filter out empty sections so we don't persist dead headers.
      finalSections = parsed.data.sections.filter((s) => s.content.trim());
      if (finalSections.length === 0) finalSections = null;
      const rendered = finalSections
        ? renderSectionsToSummary(finalSections)
        : "";
      // If the caller didn't supply an explicit summary, derive it
      // from the rendered sections so list views still show preview text.
      if (!finalSummary && rendered) finalSummary = rendered;
    }
    if (!finalSummary) {
      return NextResponse.json(
        { error: "Write at least one section before posting." },
        { status: 400 }
      );
    }

    // Posting a status-update record is open to any viewer/commenter
    // (they're posting a comment, effectively). But driving the live
    // project.status badge is a write action and gated to editors+.
    const wantsSync = parsed.data.syncProjectStatus;
    const canSync = canEditProject(access.project, access.member, userId);
    if (wantsSync && !canSync) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to change this project's status. Ask an editor or admin.",
        },
        { status: 403 }
      );
    }

    const created = await prisma.statusUpdate.create({
      data: {
        projectId,
        authorId: userId,
        status: parsed.data.status,
        summary: finalSummary,
        // Prisma's Json column accepts the array directly; we
        // stringify-then-parse to scrub any non-JSON-safe values
        // (e.g. undefined) before insert.
        sections: finalSections
          ? JSON.parse(JSON.stringify(finalSections))
          : undefined,
      },
    });

    if (wantsSync) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: parsed.data.status },
      });
    }

    const author = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, image: true },
    });

    // ── STATUS_UPDATE fan-out (best-effort) ─────────────────────
    // Notify project members (owner + explicit members) that a new
    // status update landed, excluding the author. Gated by
    // notifyProjectUpdates. Wrapped so a notification failure never
    // rolls back the already-committed status update.
    try {
      const memberIds = new Set<string>();
      if (access.project.ownerId) memberIds.add(access.project.ownerId);
      for (const m of access.project.members) memberIds.add(m.userId);
      memberIds.delete(userId); // never notify the author

      const gated: string[] = [];
      for (const uid of memberIds) {
        if (await shouldNotify(uid, "STATUS_UPDATE")) gated.push(uid);
      }

      if (gated.length > 0) {
        const authorName = author?.name ?? author?.email ?? "A teammate";
        const preview = finalSummary.slice(0, 140);
        await prisma.notification.createMany({
          data: gated.map((recipientId) => ({
            userId: recipientId,
            type: "STATUS_UPDATE" as const,
            title: `${authorName} posted a status update`,
            message: preview,
            data: {
              projectId,
              statusUpdateId: created.id,
              status: created.status,
              authorName,
              authorImage: author?.image ?? null,
            },
          })),
        });
      }
    } catch (err) {
      console.error("[project status-updates STATUS_UPDATE fan-out] failed:", err);
    }

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
        summary: created.summary,
        sections: created.sections ?? null,
        createdAt: created.createdAt.toISOString(),
        author: author ?? null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[project status-updates POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create status update" },
      { status: 500 }
    );
  }
}
