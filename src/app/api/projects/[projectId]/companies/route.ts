import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getProjectAccess } from "@/lib/project-access";
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
 *  - write: whoever can manage the project (owner, member ADMIN, or a
 *    workspace OWNER/ADMIN) — staffing a project is a management action.
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

// Canonical read rule (matches the page). An unreadable project answers 404,
// same as a missing one, so ids cannot be probed. Write follows canManage,
// which includes the workspace OWNER/ADMIN arm an inline owner/ADMIN check
// left out.
async function loadProjectAccess(projectId: string, userId: string) {
  const access = await getProjectAccess(projectId, userId);
  if (!access.ok) return { ok: false as const, status: 404 };
  return { ok: true as const, canWrite: access.canManage };
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    // Members not attached to any firm (companyId=null) — includes every
    // project's creator. Previously invisible because the Team tab only
    // renders company groups; surface them as an "Unaffiliated" group.
    const unaffiliated = await prisma.projectMember.findMany({
      where: { projectId, companyId: null },
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
    });

    return NextResponse.json({
      canWrite: access.canWrite,
      companies: shaped,
      unaffiliatedMembers: unaffiliated.map((m) => ({
        id: m.id,
        userId: m.userId,
        projectRole: m.role,
        joinedAt: m.joinedAt.toISOString(),
        user: m.user,
      })),
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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!access.canWrite) {
      return NextResponse.json(
        { error: "Only a project or workspace admin can add companies" },
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

    // Only one isOwn=true per project. Demote any existing one if the
    // caller flags this new company as own — in the same transaction as the
    // create, so a duplicate-name failure does not strip the host firm.
    const created = await prisma.$transaction(async (tx) => {
      if (parsed.data.isOwn) {
        await tx.projectCompany.updateMany({
          where: { projectId, isOwn: true },
          data: { isOwn: false },
        });
      }
      return tx.projectCompany.create({
        data: {
          projectId,
          name: parsed.data.name.trim(),
          role: parsed.data.role as CompanyRole,
          domain: parsed.data.domain ?? null,
          isOwn: parsed.data.isOwn ?? false,
        },
      });
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
