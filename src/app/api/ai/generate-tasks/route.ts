import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { text, instructions } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Missing text content' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a task extraction assistant. Your job is to analyze text content and extract actionable tasks from it.

Return a JSON array of task objects. Each task object must have:
- "name": string (concise task title, imperative form, e.g. "Review Q1 budget report")
- "dueDate": string | null (ISO 8601 date if mentioned or inferable, otherwise null)
- "priority": "NONE" | "LOW" | "MEDIUM" | "HIGH" (infer from context/urgency)

Rules:
- Extract ONLY actionable tasks (things someone needs to do)
- Keep task names concise but descriptive (5-12 words ideal)
- Use imperative form ("Review...", "Update...", "Send...", "Complete...")
- If dates are mentioned relative to today, calculate them (today is ${new Date().toISOString().split('T')[0]})
- If no clear priority, use "NONE"
- Return ONLY the JSON array, no other text or markdown`;

    const userContent = instructions
      ? `${instructions}\n\n---\n\nContent to extract tasks from:\n\n${text}`
      : `Extract actionable tasks from the following content:\n\n${text}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: userContent },
      ],
      system: systemPrompt,
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON response
    let tasks;
    try {
      // Strip potential markdown code fences
      const cleaned = responseText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      tasks = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response as tasks' },
        { status: 500 }
      );
    }

    if (!Array.isArray(tasks)) {
      return NextResponse.json(
        { error: 'AI response was not a task array' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('AI Generate Tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to generate tasks' },
      { status: 500 }
    );
  }
}
