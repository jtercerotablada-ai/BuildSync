import { NextRequest, NextResponse } from "next/server";
import { resolveShareLink } from "@/lib/client-link/access";
import { sendClientReplyNotification } from "@/lib/email";
import prisma from "@/lib/prisma";

/**
 * The client's reply box — the ONLY write a share link can perform.
 *
 * Same trust model as the page itself: the token IS the credential.
 * resolveShareLink re-checks revocation and expiry on every call and returns
 * null identically for unknown/revoked/expired, so this endpoint 404s without
 * ever confirming a link existed.
 *
 * The created message carries clientLinkId + clientAuthorLabel and NO
 * authorId — that pair is what renders it internally as e.g. "Board president
 * (Client)" instead of "Unknown", and what makes it visible back on the
 * portal thread (see isClientVisibleMessage). Content is stored verbatim and
 * rendered as text everywhere; nothing here interprets it.
 */

export const dynamic = "force-dynamic";

const MAX_LENGTH = 2000;
/** A share link may post at most this many replies per hour — a courtesy
 *  brake on a public endpoint, not an auth mechanism. */
const HOURLY_CAP = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const link = await resolveShareLink(token);
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = (body as { content?: unknown })?.content;
  const content = typeof raw === "string" ? raw.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (content.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const recentCount = await prisma.message.count({
    where: {
      clientLinkId: link.id,
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentCount >= HOURLY_CAP) {
    return NextResponse.json(
      { error: "Too many messages — please try again later" },
      { status: 429 }
    );
  }

  await prisma.message.create({
    data: {
      content,
      projectId: link.projectId,
      clientLinkId: link.id,
      clientAuthorLabel: link.label,
    },
  });

  // Tell the firm without making the client wait on it. A client reply has
  // no authorId and mentions nobody, so WITHOUT this email no internal
  // notification would ever fire — the reply would sit unread until someone
  // happened to open the project chat.
  void (async () => {
    try {
      const project = await prisma.project.findUnique({
        where: { id: link.projectId },
        select: {
          id: true,
          name: true,
          owner: { select: { email: true } },
        },
      });
      if (project?.owner?.email) {
        await sendClientReplyNotification(project.owner.email, {
          projectId: project.id,
          projectName: project.name,
          label: link.label,
          content,
        });
      }
    } catch (err) {
      console.error("[client reply] owner notification failed:", err);
    }
  })();

  return NextResponse.json({ ok: true }, { status: 201 });
}
