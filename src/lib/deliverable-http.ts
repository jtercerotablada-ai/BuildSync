/**
 * deliverable-http.ts — the error/validation plumbing every Deliverables
 * route shares, so each answers the same status codes the same way:
 *
 *   401 no session · 400 validation · 404 unreadable (never 403 to read)
 *   403 write denied on a readable project · 409 state conflict · 500 else
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth-utils";
import {
  AuthorizationError,
  NotFoundError,
  getErrorStatus,
} from "@/lib/auth-guards";
import { BadRequestError } from "@/lib/http";
import { BlobRejectedError } from "@/lib/storage";
import { parseDateOnly } from "@/lib/deliverables";

/** A refusal with a status (and optional machine code) the route returns. */
export class DeliverableHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "DeliverableHttpError";
  }
}

export const WRITE_DENIED = "You don't have permission to edit this project";
export const STALE_MESSAGE = "This item changed. Refresh and try again.";

export const notFoundResponse = (what = "Deliverable") =>
  NextResponse.json({ error: `${what} not found` }, { status: 404 });

export const staleResponse = () =>
  NextResponse.json({ error: STALE_MESSAGE }, { status: 409 });

export function writeDenied(): never {
  throw new DeliverableHttpError(403, WRITE_DENIED);
}

/** The signed-in caller, with the name snapshotted onto events. */
export async function requireCaller(): Promise<
  { id: string; actorName: string } | null
> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, actorName: user.name || user.email || "Someone" };
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** Map any error a Deliverables route can throw to its response. */
export function deliverableErrorResponse(
  error: unknown,
  fallback: string
): NextResponse {
  if (error instanceof DeliverableHttpError) {
    return NextResponse.json(
      error.code ? { error: error.message, code: error.code } : { error: error.message },
      { status: error.status }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Validation error" },
      { status: 400 }
    );
  }
  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof BlobRejectedError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof AuthorizationError || error instanceof NotFoundError) {
    const { status, message } = getErrorStatus(error);
    return NextResponse.json({ error: message }, { status });
  }
  if (isUniqueViolation(error)) {
    return NextResponse.json(
      { error: "That number or label is already used." },
      { status: 409 }
    );
  }
  console.error(`[deliverables] ${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// ── zod pieces ─────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → UTC-midnight Date; null clears; absent leaves alone. */
export const dateOnlyInput = z
  .string()
  .nullable()
  .transform((v, ctx) => {
    if (v === null || v.trim() === "") return null;
    const d = parseDateOnly(v.trim());
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Use a YYYY-MM-DD date." });
      return z.NEVER;
    }
    return d;
  });

/** Trimmed text; "" becomes null. */
export const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} is too long.`)
    .nullable()
    .transform((s) => (s == null ? null : s.trim() || null));
