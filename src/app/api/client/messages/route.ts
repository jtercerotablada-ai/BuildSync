import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get("otherUserId");
    const projectId = searchParams.get("projectId");

    // If specific thread requested, return those messages
    if (otherUserId) {
      const where: Record<string, unknown> = {
        OR: [
          { senderId: user.id, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: user.id },
        ],
      };

      if (projectId) {
        where.projectId = projectId;
      }

      const messages = await prisma.directMessage.findMany({
        where,
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, image: true } },
        },
      });

      return NextResponse.json({
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          senderId: m.senderId,
          senderName: m.sender.name || "Unknown",
          senderImage: m.sender.image,
          createdAt: m.createdAt,
          read: m.read,
        })),
      });
    }

    // Otherwise return all messages grouped by conversations
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, image: true } },
        receiver: { select: { id: true, name: true, image: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Client messages GET error:", error);
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

    const body = await request.json();
    const { content, receiverId, projectId } = body;

    if (!content || !receiverId) {
      return NextResponse.json(
        { error: "content and receiverId are required" },
        { status: 400 }
      );
    }

    // If projectId is provided, verify client has access
    if (projectId) {
      const access = await prisma.clientProjectAccess.findUnique({
        where: { userId_projectId: { userId: user.id, projectId } },
      });
      if (!access) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const message = await prisma.directMessage.create({
      data: {
        content,
        senderId: user.id,
        receiverId,
        projectId: projectId || null,
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Client messages POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
