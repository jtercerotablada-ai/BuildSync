import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

    const approvals = await prisma.clientApproval.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      approvals.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        comments: a.comments,
        createdAt: a.createdAt,
        projectId: a.projectId,
        projectName: a.project.name,
        taskId: a.taskId,
        taskName: a.task?.name || null,
      }))
    );
  } catch (error) {
    console.error("Client approvals GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { approvalId, status, comments } = body;

    if (!approvalId || !status) {
      return NextResponse.json(
        { error: "approvalId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["APPROVED", "REJECTED", "CHANGES_REQUESTED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify the approval belongs to this client
    const approval = await prisma.clientApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    if (approval.clientId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (approval.status !== "PENDING") {
      return NextResponse.json(
        { error: "This approval has already been responded to" },
        { status: 400 }
      );
    }

    const updated = await prisma.clientApproval.update({
      where: { id: approvalId },
      data: {
        status,
        comments: comments || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Client approvals PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
