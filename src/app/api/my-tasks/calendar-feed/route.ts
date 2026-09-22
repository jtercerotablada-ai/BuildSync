import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { contributorSeatSatisfied } from "@/lib/auth-guards";

function escapeICalText(text: string): string {
  // CR goes too: a bare \r inside a content line let a task name or
  // description start an iCal property of its own.
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** RFC 5545 §3.1: content lines longer than 75 octets must be folded
 *  (CRLF + one space). Strict clients dropped events whose long SUMMARY or
 *  DESCRIPTION arrived unfolded. Counts UTF-8 bytes and never splits a
 *  character. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // The first line holds 75 octets; continuation lines lose one to the
  // leading space.
  let limit = 75;
  for (const ch of line) {
    const bytes = encoder.encode(ch).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += ch;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Same derivation as url/route.ts (a route file may only export handlers,
 *  so it cannot be shared) — keep the two identical. */
function feedToken(secret: string, uid: string, key: string | null): string {
  return crypto
    .createHmac("sha256", secret)
    .update(key ? `${uid}:${key}` : uid)
    .digest("hex");
}

function readFeedKey(uiState: unknown): string | null {
  if (!uiState || typeof uiState !== "object") return null;
  const feed = (uiState as Record<string, unknown>).calendarFeed;
  if (!feed || typeof feed !== "object") return null;
  const key = (feed as Record<string, unknown>).key;
  return typeof key === "string" && key ? key : null;
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatTimestampUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getPriority(priority: string): number | null {
  switch (priority) {
    case "HIGH":
      return 1;
    case "MEDIUM":
      return 5;
    case "LOW":
      return 9;
    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid");
    const token = searchParams.get("token");

    if (!uid || !token) {
      return new NextResponse("Missing uid or token", { status: 400 });
    }

    // Validate HMAC token
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return new NextResponse("Server configuration error", { status: 500 });
    }
    // Once the user has reset the link (POST url/route.ts) a per-user key
    // exists and only a token derived from it is accepted, so every URL
    // handed out before the reset stops working.
    const prefs = await prisma.userPreferences.findUnique({
      where: { userId: uid },
      select: { uiState: true },
    });
    const expectedToken = feedToken(secret, uid, readFeedKey(prefs?.uiState));

    const tokenBuffer = Buffer.from(token || "");
    const expectedBuffer = Buffer.from(expectedToken);
    if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return new NextResponse("Invalid token", { status: 403 });
    }

    // Fetch tasks assigned to this user that have a due date.
    // Windowed and capped: an unbounded feed handed the subscriber every
    // task they had ever been assigned, so years of finished work kept
    // reappearing in their calendar. A quarter back and a year ahead is
    // what a calendar client can usefully show.
    const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // A valid token is not enough on its own: the feed serves only someone
    // who still holds a contributor seat, and only tasks of the workspaces
    // that seat is in. Offboarding deletes the membership but leaves tasks
    // assigned, so an ex-employee's subscribed calendar kept pulling the
    // firm's task names and descriptions indefinitely. Answered exactly like
    // a bad token on purpose.
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: uid },
      select: { workspaceId: true, role: true },
    });
    const seatWorkspaceIds = memberships
      .filter((m) => contributorSeatSatisfied(m.role))
      .map((m) => m.workspaceId);
    if (seatWorkspaceIds.length === 0) {
      return new NextResponse("Invalid token", { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: uid,
        dueDate: { gte: windowStart, lte: windowEnd },
        OR: [
          // Archived jobs drop out of every other list in the app too.
          {
            project: {
              workspaceId: { in: seatWorkspaceIds },
              isArchived: false,
            },
          },
          // Personal to-dos have no project and belong to the user.
          { projectId: null },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 1000,
      select: {
        id: true,
        name: true,
        description: true,
        completed: true,
        dueDate: true,
        priority: true,
      },
    });

    const now = new Date();
    const dtstamp = formatTimestampUTC(now);

    // Build iCal content
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TT//Tasks//EN",
      "X-WR-CALNAME:TT Tasks",
      "METHOD:PUBLISH",
    ];

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const dtstart = formatDateUTC(task.dueDate);
      const dtend = formatDateUTC(addDays(task.dueDate, 1));
      const priority = getPriority(task.priority);
      // VEVENT allows only TENTATIVE / CONFIRMED / CANCELLED — COMPLETED
      // belongs to VTODO, and strict clients rejected the event. A finished
      // task is marked in its title instead.
      const summary = task.completed ? `✓ ${task.name}` : task.name;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${task.id}@buildsync`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      lines.push(`DTEND;VALUE=DATE:${dtend}`);
      lines.push(foldLine(`SUMMARY:${escapeICalText(summary)}`));
      if (task.description) {
        lines.push(foldLine(`DESCRIPTION:${escapeICalText(task.description)}`));
      }
      lines.push("STATUS:CONFIRMED");
      if (priority !== null) {
        lines.push(`PRIORITY:${priority}`);
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tt-tasks.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Calendar feed error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
