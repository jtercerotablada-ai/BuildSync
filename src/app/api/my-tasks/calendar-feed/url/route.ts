import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = session.user.id;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const token = crypto
      .createHmac("sha256", secret)
      .update(uid)
      .digest("hex");

    // Build the absolute URL for the calendar feed
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const host = request.headers.get("host") || "localhost:3000";
    const url = `${proto}://${host}/api/my-tasks/calendar-feed?uid=${encodeURIComponent(uid)}&token=${token}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Calendar feed URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar feed URL" },
      { status: 500 }
    );
  }
}
