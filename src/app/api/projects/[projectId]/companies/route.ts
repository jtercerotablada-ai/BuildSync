import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import type { CompanyRole } from "@prisma/client";

/**
 * GET  /api/projects/:projectId/companies — list firms participating
 * POST /api/projects/:projectId/companies — add a new firm to the project
 *
 * Companies are the AEC-style "Project Stakeholders": the structural
 * firm, the architect, the GC, the owner. Each company has its own
 * ProjectMembers (people from that firm working on this project).
 *
 * Access:
 *  - read: anyone with project read access (members, owner, workspace
 *    members for WORKSPACE-visible projects, anyone for PUBLIC).
 *  - write: project OWNER or ADMIN only.
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

const createSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.enum(COMPANY_ROLE_ENUM),
  domain: z.string().max(255).optional().nullable(),
  isOwn: z.boolean().optional(),
});

async function loadProjectAccess(projectId: string, userId: string) {
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

  const member = project.members.find((m) => m.userId === userId);
  const isOwner = project.ownerId === userId;
  const isMember = !!member;
  let readable =
    isOwner || isMember || project.visibility === "PUBLIC";
  if (!readable && project.visibility === "WORKSPACE") {
    const wsMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId: project.workspaceId },
      },
    });
    if (wsMember) readable = true;
  }
  if (!readable) return { ok: false as const, status: 403 };

  const canWrite = isOwner || member?.role === "ADMIN";
  return { ok: true as const, project, canWrite };
}

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
    const access = await loadProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }

    const companies = await prisma.projectCompany.findMany({
      where: { projectId },
      orderBy: [{ isOwn: "desc" }, { createdAt: "asc" }],
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                position: true,
                customTitle: true,
                jobTitle: true,
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    const shaped = companies.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      logoUrl: c.logoUrl,
      domain: c.domain,
      isOwn: c.isOwn,
      linkedWorkspaceId: c.linkedWorkspaceId,
      createdAt: c.createdAt.toISOString(),
      members: c.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        projectRole: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      })),
    }));

    return NextResponse.json({
      canWrite: access.canWrite,
      companies: shaped,
    });
  } catch (err) {
    console.error("[companies GET] error:", err);
    return NextResponse.json(
      { error: "Failed to load" },
      { status: 500 }
    );
  }
}

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
    const access = await loadProjectAccess(projectId, userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.status === 404 ? "Not found" : "Forbidden" },
        { status: access.status }
      );
    }
    if (!access.canWrite) {
      return NextResponse.json(
        { error: "Only project Owner / Admin can add companies" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    // Only one isOwn=true per project. Demote any existing one if
    // the caller flags this new company as own.
    if (parsed.data.isOwn) {
      await prisma.projectCompany.updateMany({
        where: { projectId, isOwn: true },
        data: { isOwn: false },
      });
    }

    const created = await prisma.projectCompany.create({
      data: {
        projectId,
        name: parsed.data.name.trim(),
        role: parsed.data.role as CompanyRole,
        domain: parsed.data.domain ?? null,
        isOwn: parsed.data.isOwn ?? false,
      },
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        role: created.role,
        domain: created.domain,
        isOwn: created.isOwn,
        logoUrl: created.logoUrl,
        linkedWorkspaceId: created.linkedWorkspaceId,
        createdAt: created.createdAt.toISOString(),
        members: [],
      },
      { status: 201 }
    );
  } catch (err) {
    // Unique constraint on [projectId, name] — surface a clear 409.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A company with that name already exists on this project" },
        { status: 409 }
      );
    }
    console.error("[companies POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create" },
      { status: 500 }
    );
  }
}
