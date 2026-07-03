import { NextResponse } from "next/server";

/**
 * Thrown when a request body isn't valid JSON. Map it to a 400 in route
 * catch blocks (see `jsonErrorResponse`) — audit: many routes call bare
 * `await req.json()`, so malformed input surfaced as a 500 instead of 400.
 */
export class BadRequestError extends Error {
  constructor(message = "Request body must be valid JSON") {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * Parse a JSON request body, throwing BadRequestError (→ 400) instead of
 * letting a SyntaxError bubble up to a generic 500.
 *
 * Usage:
 *   const body = await readJson<MyShape>(req);
 *   ...
 *   } catch (err) {
 *     if (err instanceof BadRequestError)
 *       return NextResponse.json({ error: err.message }, { status: 400 });
 *     ...
 *   }
 */
export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequestError();
  }
}

/** Convenience: if `err` is a BadRequestError, return a 400 response; else null. */
export function jsonErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof BadRequestError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return null;
}
