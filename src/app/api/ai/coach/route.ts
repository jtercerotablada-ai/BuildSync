import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { resolveObjectiveAccess } from "@/lib/objective-access";
import { startOfTodayUtc } from "@/lib/date-only";

/**
 * POST /api/ai/coach
 *
 * AI Coach for a specific Objective. Pulls the linked projects, recent
 * KR updates, blocked / overdue tasks, and children-objective state
 * snapshot, then asks Claude for: concrete risks, actionable
 * interventions, and a one-line forecast.
 *
 * Unlike /api/ai/assist (which just relays an arbitrary prompt), this
 * route owns the prompt and context assembly so the LLM gets real
 * engineering-firm data, not a generic "improve this goal" hint.
 *
 * Body: { objectiveId: string }
 * Returns: { analysis: string } — markdown ready to render.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { objectiveId } = await req.json();
    if (!objectiveId || typeof objectiveId !== "string") {
      return NextResponse.json(
        { error: "objectiveId is required" },
        { status: 400 }
      );
    }

    // Read gate BEFORE the context query, not after: this route hands the model
    // the goal's name, every key result, the last check-ins and the linked work,
    // so "same workspace" is not a strong enough answer once a goal can be
    // private. resolveObjectiveAccess is the single rule the objective routes
    // use; it answers 404 rather than 403 so a private goal's existence stays
    // hidden.
    const access = await resolveObjectiveAccess(objectiveId, userId);
    if (!access.ok || !access.canRead) {
      return NextResponse.json(
        { error: "Objective not found" },
        { status: 404 }
      );
    }

    // Pull the objective + everything that gives the model context.
    const objective = await prisma.objective.findUnique({
      where: { id: objectiveId },
      include: {
        owner: { select: { name: true } },
        team: { select: { name: true } },
        keyResults: {
          include: {
            updates: {
              orderBy: { createdAt: "desc" },
              take: 3,
            },
          },
        },
        children: {
          select: { name: true, status: true, progress: true },
        },
        projects: {
          include: {
            project: {
              select: {
                name: true,
                status: true,
                gate: true,
                type: true,
                endDate: true,
                tasks: {
                  where: { parentTaskId: null },
                  select: {
                    name: true,
                    completed: true,
                    dueDate: true,
                  },
                },
              },
            },
          },
        },
        statusUpdates: {
          // Plain comments live in this table too, with a null status. Without
          // this filter the three newest rows are usually chatter, the real
          // check-in history is pushed out of the prompt window, and the model
          // is told the goal's latest statuses are all "null".
          where: { status: { not: null } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { status: true, summary: true, createdAt: true },
        },
      },
    });

    if (!objective) {
      return NextResponse.json(
        { error: "Objective not found" },
        { status: 404 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI features not configured" },
        { status: 503 }
      );
    }

    // ── Assemble context block ─────────────────────────────────────
    const now = new Date();
    const overdueBefore = startOfTodayUtc(now);
    const overdueTasks: { project: string; task: string; daysLate: number }[] =
      [];
    let totalOpenTasks = 0;
    let totalProjectTasks = 0;

    for (const op of objective.projects) {
      for (const t of op.project.tasks) {
        totalProjectTasks++;
        if (!t.completed) {
          totalOpenTasks++;
          // Start of TODAY, not "right now": due dates are stored at UTC
          // midnight, so `< now` called everything due today overdue and then
          // reported it as "0 days late".
          if (t.dueDate && new Date(t.dueDate) < overdueBefore) {
            const daysLate = Math.floor(
              (overdueBefore.getTime() - new Date(t.dueDate).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            overdueTasks.push({
              project: op.project.name,
              task: t.name,
              daysLate,
            });
          }
        }
      }
    }

    const projectsBlock =
      objective.projects.length === 0
        ? "(no linked projects)"
        : objective.projects
            .map((op) => {
              const total = op.project.tasks.length;
              const done = op.project.tasks.filter((t) => t.completed).length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return `- ${op.project.name} [${op.project.type}/${op.project.gate}] · status=${op.project.status} · ${done}/${total} tasks (${pct}%)`;
            })
            .join("\n");

    const krBlock =
      objective.keyResults.length === 0
        ? "(no key results)"
        : objective.keyResults
            .map((kr) => {
              const range = kr.targetValue - kr.startValue;
              const pct =
                range === 0
                  ? kr.currentValue >= kr.targetValue
                    ? 100
                    : 0
                  : Math.round(
                      ((kr.currentValue - kr.startValue) / range) * 100
                    );
              const lastUpdate = kr.updates[0];
              const trend = lastUpdate
                ? ` · last update ${lastUpdate.newValue} (Δ${(lastUpdate.newValue - lastUpdate.previousValue).toFixed(1)}${kr.unit ? " " + kr.unit : ""})`
                : " · never updated";
              return `- ${kr.name}: ${kr.currentValue}/${kr.targetValue}${kr.unit ? " " + kr.unit : ""} (${pct}%)${trend}`;
            })
            .join("\n");

    const overdueBlock =
      overdueTasks.length === 0
        ? "(no overdue tasks)"
        : overdueTasks
            .slice(0, 8)
            .map(
              (o) => `- "${o.task}" in ${o.project} — ${o.daysLate} days late`
            )
            .join("\n");

    const childrenBlock =
      objective.children.length === 0
        ? "(no sub-objectives)"
        : objective.children
            .map((c) => `- ${c.name} · ${c.status} · ${c.progress}%`)
            .join("\n");

    const recentCheckIns =
      objective.statusUpdates.length === 0
        ? "(no check-ins yet)"
        : objective.statusUpdates
            .map(
              (u) =>
                `- ${u.createdAt.toISOString().slice(0, 10)} · ${u.status} · "${u.summary}"`
            )
            .join("\n");

    const context = `
OBJECTIVE: ${objective.name}
Description: ${objective.description ?? "(none)"}
Period: ${objective.period ?? "(none)"}
Status: ${objective.status} · Progress: ${objective.progress}% · Confidence: ${objective.confidenceScore ?? "—"}/10
Owner: ${objective.owner?.name ?? "—"} · Team: ${objective.team?.name ?? "—"}
End date: ${objective.endDate ? objective.endDate.toISOString().slice(0, 10) : "(none)"}

LINKED PROJECTS (${objective.projects.length}):
${projectsBlock}

Tasks across linked projects: ${totalOpenTasks} open / ${totalProjectTasks} total.

OVERDUE TASKS:
${overdueBlock}

KEY RESULTS:
${krBlock}

SUB-OBJECTIVES:
${childrenBlock}

RECENT CHECK-INS:
${recentCheckIns}
`.trim();

    const prompt = `You are an OKR coach for a structural / civil engineering firm (CONSTRUCTION, DESIGN, RECERTIFICATION, PERMIT). Analyze the objective below and respond in **markdown** with exactly three sections:

### Risks
2–3 concrete risks. Cite specific numbers from the context (overdue tasks, KR gaps, dropping confidence, etc.). One sentence each.

### Interventions this week
2–3 specific, actionable steps the owner can take in the next 7 days. Be operational — "Email the architect on Wynwood Warehouse to confirm Tuesday review" not "improve communication".

### Forecast
One sentence: are they going to hit this goal by ${objective.endDate ? objective.endDate.toISOString().slice(0, 10) : "the end of the period"}? Be direct.

Be terse. No preamble, no marketing. Use bold sparingly for the actual risk/intervention names.

${context}`;

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      // Pinned dated model ids are retired eventually, and when one is the
      // Anthropic API answers 404, which surfaced here as a bare 500 and an
      // "AI Coach failed" toast with nothing to act on. The env var lets the
      // model be moved without a deploy the next time that happens.
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ analysis: responseText });
  } catch (error) {
    console.error("AI Coach error:", error);
    // Upstream failures used to collapse into one opaque sentence, so a
    // retired model id and a revoked key looked identical from the UI and
    // both took a network trace to tell apart. The SDK's own status and
    // message are safe to pass on — they describe our call, not the user's
    // data — and the panel renders whatever comes back in `error`.
    const status =
      error instanceof Anthropic.APIError ? error.status ?? 502 : 500;
    const detail =
      error instanceof Anthropic.APIError
        ? `AI provider error ${error.status}: ${error.message}`
        : "Failed to generate AI Coach analysis";
    return NextResponse.json({ error: detail }, { status });
  }
}
