import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const INBOUND_DOMAIN = "mail.ttcivilstructural.com";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Deterministic inbound email from user ID
    const slug = session.user.id.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `${slug}@${INBOUND_DOMAIN}`;

    return NextResponse.json({ email });
  } catch (error) {
    console.error("Inbound email error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve inbound email" },
      { status: 500 }
    );
  }
}
