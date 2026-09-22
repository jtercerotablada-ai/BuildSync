import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentUserId } from '@/lib/auth-utils';
import { rateLimit } from '@/lib/rate-limit';
import { startOfTodayUtc } from '@/lib/date-only';

// Pasted meeting notes or an uploaded text file; the cap only blocks runaway
// bodies that would spend tokens (or overflow the context) for nothing.
const MAX_TEXT_LENGTH = 50000;
const MAX_INSTRUCTIONS_LENGTH = 2000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The caller's calendar day as "YYYY-MM-DD". The server runs in UTC, so from
// 20:00 in Miami its own date is already tomorrow and "due tomorrow" came out
// a day late. A client-sent day is only trusted within one day of the UTC day
// (every real time zone falls inside that window).
function resolveToday(value: unknown): string {
  const utcToday = startOfTodayUtc();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Math.abs(parsed.getTime() - utcToday.getTime()) <= MS_PER_DAY
    ) {
      return value;
    }
  }
  return utcToday.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Each call spends Anthropic tokens — throttle per user. (See
    // rate-limit.ts note on per-instance memory.)
    const limited = rateLimit(`ai-generate-tasks:${userId}`, 10, 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: 'Too many AI requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(limited.retryAfter) } }
      );
    }

    const { text, instructions, today } = await request.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Missing text content' },
        { status: 400 }
      );
    }

    if (instructions != null && typeof instructions !== 'string') {
      return NextResponse.json(
        { error: 'Instructions must be text' },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text is too long (max ${MAX_TEXT_LENGTH} characters)` },
        { status: 413 }
      );
    }

    if (instructions && instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return NextResponse.json(
        {
          error: `Instructions are too long (max ${MAX_INSTRUCTIONS_LENGTH} characters)`,
        },
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

    const systemPrompt = `You are a task extraction assistant. Your job is to analyze text content and extract actionable tasks from it.

Return a JSON array of task objects. Each task object must have:
- "name": string (concise task title, imperative form, e.g. "Review Q1 budget report")
- "dueDate": string | null (ISO 8601 date if mentioned or inferable, otherwise null)
- "priority": "NONE" | "LOW" | "MEDIUM" | "HIGH" (infer from context/urgency)

Rules:
- Extract ONLY actionable tasks (things someone needs to do)
- Keep task names concise but descriptive (5-12 words ideal)
- Use imperative form ("Review...", "Update...", "Send...", "Complete...")
- If dates are mentioned relative to today, calculate them (today is ${resolveToday(today)})
- If no clear priority, use "NONE"
- Return ONLY the JSON array, no other text or markdown`;

    const userContent = instructions
      ? `${instructions}\n\n---\n\nContent to extract tasks from:\n\n${text}`
      : `Extract actionable tasks from the following content:\n\n${text}`;

    const message = await anthropic.messages.create({
      // Pinned dated model ids are retired eventually and then answer 404;
      // the env var lets the model move without a deploy (same as the Coach).
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: userContent },
      ],
      system: systemPrompt,
    });

    // Join every text block: a response may lead with a non-text block, and
    // reading only content[0] turned that into an empty, unparseable answer.
    const responseText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!responseText) {
      return NextResponse.json(
        { error: 'The model returned no answer. Try again.' },
        { status: 502 }
      );
    }

    // Parse the JSON response
    let tasks;
    try {
      // Strip potential markdown code fences
      const cleaned = responseText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      tasks = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response as tasks' },
        { status: 502 }
      );
    }

    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'AI response was not a task array' },
        { status: 502 }
      );
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('AI Generate Tasks error:', error);
    // Pass the SDK's status and message through so a retired model id and a
    // revoked key are distinguishable from the UI (the modal shows `error`).
    const status =
      error instanceof Anthropic.APIError ? error.status ?? 502 : 500;
    const detail =
      error instanceof Anthropic.APIError
        ? `AI provider error ${error.status}: ${error.message}`
        : 'Failed to generate tasks';
    return NextResponse.json({ error: detail }, { status });
  }
}
