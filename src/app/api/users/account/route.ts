import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";

// DELETE /api/users/account
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { confirmation } = await req.json();

    if (confirmation !== "DELETE") {
      return NextResponse.json(
        { error: "Please type DELETE to confirm" },
        { status: 400 }
      );
    }

    // Nullify non-cascading references before deleting
    await prisma.comment.updateMany({
      where: { authorId: userId },
      data: { authorId: userId }, // comments cascade via User relation
    });

    await prisma.activity.updateMany({
      where: { userId },
      data: { userId }, // activities cascade via User relation
    });

    // Delete user (cascades handle Account, Session, WorkspaceMember, etc.)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
