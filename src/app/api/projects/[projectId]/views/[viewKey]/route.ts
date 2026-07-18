import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";
import { isBuiltinViewKey, BUILTIN_VIEWS } from "@/lib/project-views";

// Built-in tabs that can't be removed: Overview is the fixed landing tab and
// isn't in the "+" catalog to re-add, so hiding it would strand it.
const UNDELETABLE_VIEW_KEYS = new Set(["overview"]);

// A single project view tab: PATCH renames / sets default / hides; DELETE
// removes a copy (or soft-hides a built-in so the "+" catalog can re-add it).

const prefSelect = {
  id: true,
  viewKey: true,
  baseView: true,
  label: true,
  hidden: true,
  isDefault: true,
  position: true,
} as const;

// Count how many tabs are currently visible, so we never leave a project with
// zero tabs. Built-ins are visible unless a pref hides them; copies are the
// non-built-in prefs that aren't hidden.
async function countVisibleTabs(projectId: string): Promise<number> {
  const prefs = await prisma.projectViewPref.findMany({
    where: { projectId },
    select: { viewKey: true, hidden: true },
  });
  const hiddenBuiltins = new Set(
    prefs.filter((p) => isBuiltinViewKey(p.viewKey) && p.hidden).map((p) => p.viewKey)
  );
  const visibleBuiltins = BUILTIN_VIEWS.filter((b) => !hiddenBuiltins.has(b.key)).length;
  const visibleCopies = prefs.filter(
    (p) => !isBuiltinViewKey(p.viewKey) && !p.hidden
  ).length;
  return visibleBuiltins + visibleCopies;
}

const patchSchema = z
  .object({
    label: z.string().trim().min(1).max(120).nullable().optional(),
    hidden: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No changes");

// PATCH /api/projects/:projectId/views/:viewKey
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string; viewKey: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, viewKey } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const body = await req.json();
    const data = patchSchema.parse(body);
    const builtin = isBuiltinViewKey(viewKey);

    // Copies must already exist; built-ins are upserted on first customization.
    const existing = await prisma.projectViewPref.findUnique({
      where: { projectId_viewKey: { projectId, viewKey } },
      select: { id: true, hidden: true, baseView: true },
    });
    if (!existing && !builtin) {
      throw new NotFoundError("View not found");
    }

    // Guard: hiding the last visible tab would strand the project.
    if (data.hidden === true) {
      if (UNDELETABLE_VIEW_KEYS.has(viewKey)) {
        return NextResponse.json(
          { error: "This view can't be removed" },
          { status: 400 }
        );
      }
      const wasVisible = !existing?.hidden; // never-customized built-in: visible
      if (wasVisible && (await countVisibleTabs(projectId)) <= 1) {
        return NextResponse.json(
          { error: "A project must keep at least one view" },
          { status: 400 }
        );
      }
    }

    const baseView = existing?.baseView ?? viewKey; // built-in: baseView == key

    const result = await prisma.$transaction(async (tx) => {
      // Only one default per project — clear the others first.
      if (data.isDefault === true) {
        await tx.projectViewPref.updateMany({
          where: { projectId, isDefault: true, NOT: { viewKey } },
          data: { isDefault: false },
        });
      }
      return tx.projectViewPref.upsert({
        where: { projectId_viewKey: { projectId, viewKey } },
        create: {
          projectId,
          viewKey,
          baseView,
          label: data.label ?? undefined,
          hidden: data.hidden ?? false,
          isDefault: data.isDefault ?? false,
        },
        update: {
          ...(data.label !== undefined ? { label: data.label } : {}),
          ...(data.hidden !== undefined ? { hidden: data.hidden } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
        select: prefSelect,
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project view PATCH] error:", error);
    return NextResponse.json({ error: "Failed to update view" }, { status: 500 });
  }
}

// DELETE /api/projects/:projectId/views/:viewKey — copies are removed outright;
// built-in tabs are soft-hidden (re-addable from the "+" catalog).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; viewKey: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, viewKey } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    if (UNDELETABLE_VIEW_KEYS.has(viewKey)) {
      return NextResponse.json(
        { error: "This view can't be removed" },
        { status: 400 }
      );
    }

    const builtin = isBuiltinViewKey(viewKey);
    const existing = await prisma.projectViewPref.findUnique({
      where: { projectId_viewKey: { projectId, viewKey } },
      select: { hidden: true },
    });

    // Removing a currently-visible tab must not empty the tab strip.
    const currentlyVisible = builtin ? !existing?.hidden : !!existing;
    if (currentlyVisible && (await countVisibleTabs(projectId)) <= 1) {
      return NextResponse.json(
        { error: "A project must keep at least one view" },
        { status: 400 }
      );
    }

    if (builtin) {
      // Soft-hide so the "+" catalog can bring it back.
      await prisma.projectViewPref.upsert({
        where: { projectId_viewKey: { projectId, viewKey } },
        create: { projectId, viewKey, baseView: viewKey, hidden: true, isDefault: false },
        update: { hidden: true, isDefault: false },
      });
    } else {
      // Hard-delete the copy (no-op if it's already gone).
      await prisma.projectViewPref.deleteMany({
        where: { projectId, viewKey },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project view DELETE] error:", error);
    return NextResponse.json({ error: "Failed to delete view" }, { status: 500 });
  }
}
