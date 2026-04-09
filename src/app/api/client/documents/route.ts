import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { verifyClientAccess } from "@/lib/auth-guards";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const accesses = await prisma.clientProjectAccess.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });

    const projectIds = accesses.map((a) => a.projectId);

    const files = await prisma.file.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        uploader: { select: { name: true } },
      },
    });

    return NextResponse.json(
      files.map((f) => ({
        id: f.id,
        name: f.name,
        url: f.url,
        size: f.size,
        mimeType: f.mimeType,
        createdAt: f.createdAt,
        projectId: f.projectId,
        projectName: f.project.name,
        uploaderName: f.uploader.name,
      }))
    );
  } catch (error) {
    console.error("Client documents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "File and projectId are required" }, { status: 400 });
    }

    // Verify client has upload access
    let access;
    try {
      access = await verifyClientAccess(user.id, projectId);
    } catch {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!access.canUpload) {
      return NextResponse.json({ error: "Upload not permitted" }, { status: 403 });
    }

    // In a production environment, you would upload the file to cloud storage (S3, etc.)
    // and get back a URL. For now, we create a placeholder record.
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        url: `/uploads/${Date.now()}-${file.name}`,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        projectId,
        uploaderId: user.id,
      },
    });

    return NextResponse.json(fileRecord, { status: 201 });
  } catch (error) {
    console.error("Client documents POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
