"use client";

import { toast } from "sonner";
import { responseError } from "@/lib/direct-upload";
import type { StageOffer } from "./types";

/**
 * A refused API call, carrying what the UI branches on: the HTTP status and
 * the machine `code` some 409s send (ISSUE → "UNSEALED").
 */
export class DeliverableApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = "DeliverableApiError";
  }
}

/**
 * fetch + JSON with the Deliverables API's error contract: a non-2xx throws
 * DeliverableApiError with the server's own `error` text (fit for a toast)
 * and its `code`. Network failures throw the fallback message.
 */
export async function apiJson<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {},
  fallback = "Something went wrong"
): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers:
        json !== undefined
          ? { "Content-Type": "application/json", ...(rest.headers ?? {}) }
          : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new DeliverableApiError(fallback, 0);
  }
  if (!res.ok) {
    // Read the body once: the code rides next to the message.
    const clone = res.clone();
    const body = (await clone.json().catch(() => null)) as
      | { error?: unknown; code?: unknown }
      | null;
    const message =
      body && typeof body.error === "string"
        ? body.error
        : await responseError(res, fallback);
    throw new DeliverableApiError(
      message,
      res.status,
      body && typeof body.code === "string" ? body.code : undefined
    );
  }
  return (await res.json().catch(() => null)) as T;
}

export function errorMessage(err: unknown, fallback = "Something went wrong") {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * The stage OFFER after a seal request or an issue: a toast that asks, and
 * moves the project only when the user accepts. It never moves by itself —
 * the deliverables routes never write Project.stage.
 */
export function showStageOffer(
  offer: StageOffer,
  projectId: string,
  onMoved: () => void
) {
  toast(offer.prompt, {
    duration: 12000,
    action: {
      label: "Move stage",
      onClick: () => {
        void (async () => {
          try {
            await apiJson(
              `/api/projects/${projectId}/stage`,
              { method: "PATCH", json: { stage: offer.to.key } },
              "Couldn't move the stage"
            );
            toast.success(`Moved to ${offer.to.label}`);
            onMoved();
          } catch (err) {
            toast.error(errorMessage(err, "Couldn't move the stage"));
          }
        })();
      },
    },
  });
}
