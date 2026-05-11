import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { getUserWorkspaceId } from "@/lib/auth-guards";

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

    const workspaceId = await getUserWorkspaceId(userId);

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
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { status: true, summary: true, createdAt: true },
        },
      },
    });

    if (!objective || objective.workspaceId !== workspaceId) {
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
    const overdueTasks: { project: string; task: string; daysLate: number }[] =
      [];
    let totalOpenTasks = 0;
    let totalProjectTasks = 0;

    for (const op of objective.projects) {
      for (const t of op.project.tasks) {
        totalProjectTasks++;
        if (!t.completed) {
          totalOpenTasks++;
          if (t.dueDate && new Date(t.dueDate) < now) {
            const daysLate = Math.floor(
              (now.getTime() - new Date(t.dueDate).getTime()) /
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ analysis: responseText });
  } catch (error) {
    console.error("AI Coach error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI Coach analysis" },
      { status: 500 }
    );
  }
}
