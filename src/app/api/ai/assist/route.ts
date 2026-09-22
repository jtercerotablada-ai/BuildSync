import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-utils';
import { getUserWorkspaceId } from '@/lib/auth-guards';
import { formatPosition } from '@/lib/people-types';
import { buildProjectVisibilityClauses } from '@/lib/project-visibility';
import { rateLimit } from '@/lib/rate-limit';
import { startOfTodayUtc as utcTodayStart } from '@/lib/date-only';

const MAX_TEXT_LENGTH = 10000;
// Every first-party caller sends a short fixed instruction (< 200 chars);
// the cap only blocks scripted abuse of the relayed prompt field.
const MAX_PROMPT_LENGTH = 500;

// Caps for the qa-mode context block so a large workspace can't blow up
// the prompt: task lists, resolved @mentions and the name-candidate scan
// are all bounded.
const MAX_TASKS_PER_LIST = 10;
const MAX_TASKS_PER_MENTION = 5;
const MAX_MENTIONED_ENTITIES = 3;
const MAX_MENTION_CANDIDATES = 100;
const UPCOMING_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The caller's calendar day, sent by the client as "YYYY-MM-DD". The server
// runs in UTC, so from 20:00 in Miami its own date is already tomorrow and
// every task due today was reported as overdue. A client-sent day is only
// trusted within one day of the UTC day (every real time zone falls inside
// that window); otherwise fall back to the UTC day.
function resolveToday(value: unknown): Date {
  const utcToday = utcTodayStart();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Math.abs(parsed.getTime() - utcToday.getTime()) <= MS_PER_DAY
    ) {
      return parsed;
    }
  }
  return utcToday;
}

const formatDay = (d: Date) => d.toISOString().slice(0, 10);
const clip = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);
const taskLine = (t: {
  name: string;
  dueDate: Date | null;
  project?: { name: string } | null;
}) =>
  `- "${clip(t.name)}"${t.project?.name ? ` in ${clip(t.project.name)}` : ''}${t.dueDate ? ` — due ${formatDay(t.dueDate)}` : ''}`;

// Q&A callers (the Home AI Assistant widget) get real workspace context
// assembled server-side, the way /api/ai/coach does for objectives: the
// caller's overdue/upcoming tasks plus summaries of any @mentioned
// projects/people, resolved by name against the DB. Transform callers
// (notepad, inbox) never reach this path; the TT AI side panel does.
async function buildQaContext(
  userId: string,
  text: string,
  startOfTodayUtc: Date
): Promise<string> {
  const workspaceId = await getUserWorkspaceId(userId);

  // The canonical project list rule (the same one /api/projects applies),
  // narrowed to the workspace this context describes. A local copy of the
  // rule drifted: it missed WORKSPACE-visibility and team projects.
  const visibility = await buildProjectVisibilityClauses(userId);
  const projectScope: Prisma.ProjectWhereInput = {
    workspaceId,
    isArchived: false,
    ...(visibility ? { OR: visibility } : { id: { in: [] } }),
  };

  // Due dates are stored at UTC midnight of the due day, and
  // startOfTodayUtc is UTC midnight of the CALLER's calendar day, so a task
  // due today is never overdue and still counts as upcoming.
  const upcomingEnd = new Date(
    startOfTodayUtc.getTime() + UPCOMING_DAYS * MS_PER_DAY
  );

  // Archived projects are closed out; their leftover open tasks are not
  // work the caller still owes.
  const myTaskScope: Prisma.TaskWhereInput = {
    assigneeId: userId,
    completed: false,
    OR: [{ projectId: null }, { project: { workspaceId, isArchived: false } }],
  };

  const [
    myOverdueCount,
    myOverdue,
    myUpcomingCount,
    myUpcoming,
    memberRows,
    projectRows,
  ] = await Promise.all([
    prisma.task.count({
      where: { ...myTaskScope, dueDate: { lt: startOfTodayUtc } },
    }),
    prisma.task.findMany({
      where: { ...myTaskScope, dueDate: { lt: startOfTodayUtc } },
      orderBy: { dueDate: 'asc' },
      take: MAX_TASKS_PER_LIST,
      select: {
        name: true,
        dueDate: true,
        project: { select: { name: true } },
      },
    }),
    prisma.task.count({
      where: {
        ...myTaskScope,
        dueDate: { gte: startOfTodayUtc, lte: upcomingEnd },
      },
    }),
    prisma.task.findMany({
      where: {
        ...myTaskScope,
        dueDate: { gte: startOfTodayUtc, lte: upcomingEnd },
      },
      orderBy: { dueDate: 'asc' },
      take: MAX_TASKS_PER_LIST,
      select: {
        name: true,
        dueDate: true,
        project: { select: { name: true } },
      },
    }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      take: MAX_MENTION_CANDIDATES,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            position: true,
            customTitle: true,
            jobTitle: true,
            department: true,
          },
        },
      },
    }),
    prisma.project.findMany({
      where: projectScope,
      orderBy: { updatedAt: 'desc' },
      take: MAX_MENTION_CANDIDATES,
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        gate: true,
        endDate: true,
      },
    }),
  ]);

  // The widget inserts mentions as plain "@Full Name" text — resolve them
  // by scanning the question for each candidate name.
  const lowerText = text.toLowerCase();
  const mentionedProjects = projectRows
    .filter((p) => lowerText.includes(`@${p.name.toLowerCase()}`))
    .slice(0, MAX_MENTIONED_ENTITIES);
  const mentionedPeople = memberRows
    .flatMap(({ user }) =>
      user.name && lowerText.includes(`@${user.name.toLowerCase()}`)
        ? [{ ...user, name: user.name }]
        : []
    )
    .slice(0, MAX_MENTIONED_ENTITIES);

  // Hide other users' private tasks from mention summaries.
  const visibleTask: Prisma.TaskWhereInput = {
    OR: [{ isPrivate: false }, { assigneeId: userId }, { creatorId: userId }],
  };

  const projectBlocks = await Promise.all(
    mentionedProjects.map(async (p) => {
      const openWhere: Prisma.TaskWhereInput = {
        projectId: p.id,
        completed: false,
        ...visibleTask,
      };
      const [totalTasks, openTasks, overdue, upcoming] = await Promise.all([
        prisma.task.count({ where: { projectId: p.id, ...visibleTask } }),
        prisma.task.count({ where: openWhere }),
        prisma.task.findMany({
          where: { ...openWhere, dueDate: { lt: startOfTodayUtc } },
          orderBy: { dueDate: 'asc' },
          take: MAX_TASKS_PER_MENTION,
          select: { name: true, dueDate: true },
        }),
        prisma.task.findMany({
          where: {
            ...openWhere,
            dueDate: { gte: startOfTodayUtc, lte: upcomingEnd },
          },
          orderBy: { dueDate: 'asc' },
          take: MAX_TASKS_PER_MENTION,
          select: { name: true, dueDate: true },
        }),
      ]);
      const header = [
        `status=${p.status}`,
        p.type ? `type=${p.type}` : null,
        p.gate ? `gate=${p.gate}` : null,
        p.endDate ? `target end ${formatDay(p.endDate)}` : null,
      ]
        .filter(Boolean)
        .join(' · ');
      return [
        `Project "${clip(p.name)}" — ${header}`,
        `  Tasks: ${openTasks} open / ${totalTasks} total`,
        `  Overdue:${overdue.length ? '' : ' none'}`,
        ...overdue.map((t) => `  ${taskLine(t)}`),
        `  Due in the next ${UPCOMING_DAYS} days:${upcoming.length ? '' : ' none'}`,
        ...upcoming.map((t) => `  ${taskLine(t)}`),
      ].join('\n');
    })
  );

  const peopleBlocks = await Promise.all(
    mentionedPeople.map(async (u) => {
      const theirScope: Prisma.TaskWhereInput = {
        assigneeId: u.id,
        completed: false,
        // Only tasks in projects the CALLER can see, and never someone
        // else's private tasks.
        project: projectScope,
        ...(u.id === userId ? {} : { isPrivate: false }),
      };
      const [openCount, overdueCount, upcoming] = await Promise.all([
        prisma.task.count({ where: theirScope }),
        prisma.task.count({
          where: { ...theirScope, dueDate: { lt: startOfTodayUtc } },
        }),
        prisma.task.findMany({
          where: {
            ...theirScope,
            dueDate: { gte: startOfTodayUtc, lte: upcomingEnd },
          },
          orderBy: { dueDate: 'asc' },
          take: MAX_TASKS_PER_MENTION,
          select: {
            name: true,
            dueDate: true,
            project: { select: { name: true } },
          },
        }),
      ]);
      const role = [
        formatPosition(u.position, u.customTitle, u.jobTitle),
        u.department,
      ]
        .filter((part) => part && part !== '—')
        .join(' · ');
      return [
        `${u.name}${role ? ` (${role})` : ''} — ${openCount} open tasks, ${overdueCount} overdue (within projects visible to you)`,
        `  Due in the next ${UPCOMING_DAYS} days:${upcoming.length ? '' : ' none'}`,
        ...upcoming.map((t) => `  ${taskLine(t)}`),
      ].join('\n');
    })
  );

  const sections = [
    `Today's date: ${formatDay(startOfTodayUtc)}. Due dates are date-only; a task due today is NOT overdue.`,
    myOverdue.length
      ? `MY OVERDUE TASKS (showing ${myOverdue.length} of ${myOverdueCount}):\n${myOverdue.map(taskLine).join('\n')}`
      : 'MY OVERDUE TASKS: none',
    myUpcoming.length
      ? `MY TASKS DUE IN THE NEXT ${UPCOMING_DAYS} DAYS (showing ${myUpcoming.length} of ${myUpcomingCount}):\n${myUpcoming.map(taskLine).join('\n')}`
      : `MY TASKS DUE IN THE NEXT ${UPCOMING_DAYS} DAYS: none`,
  ];
  if (projectBlocks.length) {
    sections.push(`MENTIONED PROJECTS:\n${projectBlocks.join('\n')}`);
  }
  if (peopleBlocks.length) {
    sections.push(`MENTIONED PEOPLE:\n${peopleBlocks.join('\n')}`);
  }
  return sections.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Each call spends Anthropic tokens — throttle per user. (See
    // rate-limit.ts note on per-instance memory.)
    const limited = rateLimit(`ai-assist:${userId}`, 20, 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many AI requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } }
      );
    }

    const { prompt, text, mode, today } = await request.json();

    if (!text || !prompt || typeof text !== 'string' || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Missing text or prompt' },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text is too long (max ${MAX_TEXT_LENGTH} characters)` },
        { status: 413 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters)` },
        { status: 413 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI features not configured' },
        { status: 503 }
      );
    }
    const anthropic = new Anthropic({ apiKey });

    // Transform callers (notepad) want only the rewritten text back; Q&A
    // callers want a normal answer built on their workspace context;
    // 'summary' callers (inbox) want the prompt answered as asked over the
    // text they sent, with no workspace context. Default to 'transform' for
    // existing callers that don't send a mode.
    const suffix =
      mode === 'qa' || mode === 'summary'
        ? ''
        : '\n\nRespond only with the improved/modified text, without any explanations or additional commentary.';

    // Context assembly must never take the whole request down — fall back
    // to a contextless answer if it fails.
    let contextBlock = '';
    if (mode === 'qa') {
      try {
        contextBlock = await buildQaContext(userId, text, resolveToday(today));
      } catch (contextError) {
        console.error('AI Assist context error:', contextError);
      }
    }

    const preamble = contextBlock
      ? `You are the AI assistant inside BuildSync, a project management app for a structural / civil engineering firm. Use the workspace context below whenever the question relates to it — cite the real task/project names and dates, and never invent tasks, projects or people that are not in the context. The context is scoped to the asking user. If the question is unrelated to the context, just answer it directly.\n\n${contextBlock}\n\n`
      : '';

    const message = await anthropic.messages.create({
      // Pinned dated model ids are retired eventually and then answer 404;
      // the env var lets the model move without a deploy (same as the Coach).
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${preamble}${prompt}\n\n${text}${suffix}`,
        },
      ],
    });

    // Extract text from response — join every text block so a non-text
    // first block doesn't collapse the whole answer to ''.
    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    // An empty answer is a failure, not a successful blank reply; saying so
    // lets every caller show its error state instead of an empty result.
    if (!responseText) {
      return NextResponse.json(
        { error: 'The model returned no answer. Try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ result: responseText });
  } catch (error) {
    console.error('AI Assist error:', error);
    // Pass the SDK's status and message through so a retired model id and a
    // revoked key are distinguishable from the UI.
    const status =
      error instanceof Anthropic.APIError ? error.status ?? 502 : 500;
    const detail =
      error instanceof Anthropic.APIError
        ? `AI provider error ${error.status}: ${error.message}`
        : 'Failed to process AI request';
    return NextResponse.json({ error: detail }, { status });
  }
}
