import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, text } = await request.json();

    if (!text || !prompt) {
      return NextResponse.json(
        { error: 'Missing text or prompt' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${text}\n\nRespond only with the improved/modified text, without any explanations or additional commentary.`,
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
