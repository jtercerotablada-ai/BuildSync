import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getProjectAccess } from "@/lib/project-access";
import { readJson } from "@/lib/http";
import {
  DELIVERABLE_KINDS,
  NUMBER_MAX_LENGTH,
  REVISION_LABEL_PATTERN,
  compareDeliverableRows,
  defaultDueDate,
  initialStatus,
  isDeliverableKind,
  isDocType,
  isOpen,
  nextDeliverableNumber,
  normalizeCode,
  utcMidnight,
  type DeliverableKind,
} from "@/lib/deliverables";
import {
  isAssignableUser,
  listAssignableUsers,
  resolveDeliverablePerms,
} from "@/lib/deliverable-access";
import {
  deliverableRowSelect,
  loadDetailJSON,
  toRowJSON,
} from "@/lib/deliverable-serialize";
import {
  DeliverableHttpError,
  WRITE_DENIED,
  dateOnlyInput,
  deliverableErrorResponse,
  isUniqueViolation,
  notFoundResponse,
  optionalText,
  requireCaller,
} from "@/lib/deliverable-http";

/**
 * GET  /api/projects/:projectId/deliverables?kind=DOCUMENT|RFI|SUBMITTAL
 *      The register: every item (optionally one kind), the caller's
 *      permissions, the project fields the tab shows, open/total counts per
 *      kind (always all kinds), and who items may be assigned to.
 * POST /api/projects/:projectId/deliverables
 *      Create a document / RFI / submittal (+ Rev 1 for documents and
 *      submittals, + a CREATED event) in one transaction.
 */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { projectId } = await params;

    const kindParam = new URL(req.url).searchParams.get("kind");
    if (kindParam !== null && !isDeliverableKind(kindParam)) {
      return NextResponse.json(
        { error: "kind must be DOCUMENT, RFI or SUBMITTAL" },
        { status: 400 }
      );
    }

    const access = await getProjectAccess(projectId, caller.id);
    if (!access.ok) return notFoundResponse("Project");

    const [perms, project, rows, all, assignableUsers] = await Promise.all([
      resolveDeliverablePerms(access, caller.id),
      prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          // The Seal authority popover edits THIS workspace's seats.
          workspaceId: true,
          type: true,
          stage: true,
          clientName: true,
          jurisdiction: true,
          clientContactName: true,
          clientContactEmail: true,
          permitNumber: true,
          caseNumber: true,
        },
      }),
      prisma.deliverable.findMany({
        where: { projectId, ...(kindParam ? { kind: kindParam } : {}) },
        select: deliverableRowSelect,
      }),
      prisma.deliverable.findMany({
        where: { projectId },
        select: { kind: true, status: true },
      }),
      listAssignableUsers(projectId),
    ]);
    if (!project) return notFoundResponse("Project");

    const counts = Object.fromEntries(
      DELIVERABLE_KINDS.map((k) => [k, { open: 0, total: 0 }])
    ) as Record<DeliverableKind, { open: number; total: number }>;
    for (const d of all) {
      if (!isDeliverableKind(d.kind)) continue;
      counts[d.kind].total += 1;
      if (isOpen(d.kind, d.status)) counts[d.kind].open += 1;
    }

    const items = rows.map(toRowJSON).sort(compareDeliverableRows);

    return NextResponse.json({
      items,
      permissions: {
        canWrite: perms.canWrite,
        canSeal: perms.canSeal,
        canMoveStage: perms.canMoveStage,
        isWorkspaceOwner: perms.isWorkspaceOwner,
        // OWNER/ADMIN: may undo someone else's issue or review.
        isWorkspaceManager: perms.isWorkspaceManager,
      },
      project,
      counts,
      assignableUsers,
    });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to load deliverables");
  }
}

const createSchema = z.object({
  kind: z.enum(["DOCUMENT", "RFI", "SUBMITTAL"]),
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "Enter a title.")
        .max(200, "The title is too long.")
    ),
  number: z
    .string()
    .transform((s) => normalizeCode(s))
    .pipe(
      z
        .string()
        .min(1, "Enter a number.")
        .max(NUMBER_MAX_LENGTH, "The number is too long.")
    )
    .nullable()
    .optional(),
  docType: z.string().nullable().optional(),
  description: optionalText(10000, "The description").optional(),
  dueDate: dateOnlyInput.optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  party: optionalText(200, "The party").optional(),
  receivedAt: dateOnlyInput.optional(),
  sealRequired: z.boolean().optional(),
  firstRevisionLabel: z
    .string()
    .trim()
    .regex(REVISION_LABEL_PATTERN, "Use up to 12 letters, digits, dots or dashes.")
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const caller = await requireCaller();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { projectId } = await params;

    const access = await getProjectAccess(projectId, caller.id);
    if (!access.ok) return notFoundResponse("Project");
    if (!access.canWrite) {
      return NextResponse.json({ error: WRITE_DENIED }, { status: 403 });
    }

    const data = createSchema.parse(await readJson(req));
    const kind = data.kind;

    let docType: string | null = null;
    if (kind === "DOCUMENT") {
      if (!isDocType(data.docType)) {
        throw new DeliverableHttpError(400, "Choose a document type.");
      }
      docType = data.docType;
    }

    if (data.assigneeId && !(await isAssignableUser(projectId, data.assigneeId))) {
      throw new DeliverableHttpError(400, "Assignee is not in this workspace");
    }

    const today = utcMidnight(new Date());
    const receivedAt =
      kind === "DOCUMENT" ? null : data.receivedAt === undefined ? today : data.receivedAt;
    const dueDate =
      data.dueDate !== undefined
        ? data.dueDate
        : defaultDueDate(kind, receivedAt ?? today);
    const sealRequired = kind === "DOCUMENT" ? data.sealRequired ?? true : false;
    const label = normalizeCode(data.firstRevisionLabel || "0");
    const status = initialStatus(kind);
    const numberGiven = !!data.number;

    const create = async (number: string) =>
      prisma.$transaction(async (tx) => {
        const item = await tx.deliverable.create({
          data: {
            projectId,
            kind,
            docType,
            number,
            title: data.title,
            description: data.description ?? null,
            status,
            dueDate,
            sealRequired,
            party: data.party ?? null,
            receivedAt,
            assigneeId: data.assigneeId ?? null,
            createdById: caller.id,
          },
          select: { id: true },
        });
        if (kind !== "RFI") {
          await tx.deliverableRevision.create({
            data: {
              deliverableId: item.id,
              sequence: 1,
              label,
              receivedAt: kind === "SUBMITTAL" ? receivedAt : null,
              createdById: caller.id,
            },
          });
        }
        await tx.deliverableEvent.create({
          data: {
            deliverableId: item.id,
            type: "CREATED",
            toStatus: status,
            note: number,
            actorId: caller.id,
            actorName: caller.actorName,
          },
        });
        return item.id;
      });

    const generate = async () => {
      const existing = await prisma.deliverable.findMany({
        where: { projectId },
        select: { number: true },
      });
      return nextDeliverableNumber(
        kind,
        existing.map((e) => e.number)
      );
    };

    let number = numberGiven ? data.number! : await generate();
    let id: string;
    try {
      id = await create(number);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      if (numberGiven) {
        throw new DeliverableHttpError(409, `${number} is already used on this project.`);
      }
      // Two people auto-numbering at once: take the next one and try again.
      number = await generate();
      try {
        id = await create(number);
      } catch (err2) {
        if (isUniqueViolation(err2)) {
          throw new DeliverableHttpError(409, `${number} is already used on this project.`);
        }
        throw err2;
      }
    }

    const detail = await loadDetailJSON(id);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    return deliverableErrorResponse(error, "Failed to create deliverable");
  }
}
