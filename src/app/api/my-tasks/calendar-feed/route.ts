import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
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
    const expectedToken = crypto
      .createHmac("sha256", secret)
      .update(uid)
      .digest("hex");

    const tokenBuffer = Buffer.from(token || "");
    const expectedBuffer = Buffer.from(expectedToken);
    if (tokenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)) {
      return new NextResponse("Invalid token", { status: 403 });
    }

    // Fetch tasks assigned to this user that have a due date
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: uid,
        dueDate: { not: null },
      },
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
      const status = task.completed ? "COMPLETED" : "CONFIRMED";
      const priority = getPriority(task.priority);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${task.id}@buildsync`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
      lines.push(`DTEND;VALUE=DATE:${dtend}`);
      lines.push(`SUMMARY:${escapeICalText(task.name)}`);
      if (task.description) {
        lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
      }
      lines.push(`STATUS:${status}`);
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
