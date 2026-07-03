import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getCurrentUserId } from '@/lib/auth-utils';
import { rateLimit } from '@/lib/rate-limit';

const MAX_TEXT_LENGTH = 10000;

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

    const { prompt, text, mode } = await request.json();

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI features not configured' },
        { status: 503 }
      );
    }
    const anthropic = new Anthropic({ apiKey });

    // Transform callers (notepad, inbox, ai-panel) want only the rewritten
    // text back; Q&A callers want a normal answer. Default to 'transform'
    // for existing callers that don't send a mode.
    const suffix =
      mode === 'qa'
        ? ''
        : '\n\nRespond only with the improved/modified text, without any explanations or additional commentary.';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${text}${suffix}`,
        },
      ],
    });

    // Extract text from response
    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return NextResponse.json({ result: responseText });
  } catch (error) {
    console.error('AI Assist error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
