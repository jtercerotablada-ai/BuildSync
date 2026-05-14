import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import type { CompanyRole } from "@prisma/client";

/**
 * PATCH  /api/projects/:projectId/companies/:companyId — edit company
 * DELETE /api/projects/:projectId/companies/:companyId — remove company
 *
 * Same access rules as the list endpoint: only project Owner/Admin
 * may write. Removing a company unbinds its members (companyId set
 * to null on ProjectMember rows — they keep their seats in the
 * project unless removed separately).
 */

const COMPANY_ROLE_ENUM = [
  "STRUCTURAL_ENGINEER",
  "ARCHITECT",
  "CIVIL_ENGINEER",
  "MEP_ENGINEER",
  "GEOTECH_ENGINEER",
  "LANDSCAPE_ARCHITECT",
  "GENERAL_CONTRACTOR",
  "SUBCONTRACTOR",
  "OWNER_DEVELOPER",
  "CONSTRUCTION_MANAGER",
  "COMMISSIONING_AGENT",
  "INTERIOR_DESIGNER",
  "SPECIALTY_CONSULTANT",
  "BUILDING_DEPARTMENT_AHJ",
  "OTHER",
] as const;

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(COMPANY_ROLE_ENUM).optional(),
  domain: z.string().max(255).nullable().optional(),
  isOwn: z.boolean().optional(),
});

async function assertWriteAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { select: { userId: true, role: true } },
    },
  });
  if (!project) return { ok: false as const, status: 404 };
  const isOwner = project.ownerId === userId;
  const member = project.members.find((m) => m.userId === userId);
  const isAdmin = member?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return { ok: false as const, status: 403 };
  }
  return { ok: true as const };
}

export async function PATCH(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; companyId: string }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, companyId } = await params;
    const access = await assertWriteAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const company = await prisma.projectCompany.findFirst({
      where: { id: companyId, projectId },
    });
    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // Enforce single isOwn invariant.
    if (parsed.data.isOwn === true && !company.isOwn) {
      await prisma.projectCompany.updateMany({
        where: { projectId, isOwn: true },
        data: { isOwn: false },
      });
    }

    const updated = await prisma.projectCompany.update({
      where: { id: companyId },
      data: {
        ...(parsed.data.name !== undefined && {
          name: parsed.data.name.trim(),
        }),
        ...(parsed.data.role !== undefined && {
          role: parsed.data.role as CompanyRole,
        }),
        ...(parsed.data.domain !== undefined && {
          domain: parsed.data.domain,
        }),
        ...(parsed.data.isOwn !== undefined && { isOwn: parsed.data.isOwn }),
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      role: updated.role,
      domain: updated.domain,
      isOwn: updated.isOwn,
      logoUrl: updated.logoUrl,
      linkedWorkspaceId: updated.linkedWorkspaceId,
    });
  } catch (err) {
    console.error("[company PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ projectId: string; companyId: string }>;
  }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId, companyId } = await params;
    const access = await assertWriteAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }
    const company = await prisma.projectCompany.findFirst({
      where: { id: companyId, projectId },
    });
    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // The ProjectMember.companyId is SetNull on delete so members
    // unbind without losing their seat.
    await prisma.projectCompany.delete({ where: { id: companyId } });
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[company DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete" },
      { status: 500 }
    );
  }
}
