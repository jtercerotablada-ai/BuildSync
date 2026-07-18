import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth-utils";
import { uploadFile, deleteFile } from "@/lib/storage";
import {
  verifyProjectAccess,
  getErrorStatus,
  AuthorizationError,
  NotFoundError,
} from "@/lib/auth-guards";

// Key resources (Overview) — a project's curated files + links. GET lists
// them; POST adds one, either a multipart file upload or a JSON link.

const resourceSelect = {
  id: true,
  type: true,
  name: true,
  url: true,
  size: true,
  mimeType: true,
  position: true,
  createdAt: true,
  uploader: { select: { id: true, name: true, email: true, image: true } },
} as const;

// GET /api/projects/:projectId/resources
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId);

    const resources = await prisma.projectResource.findMany({
      where: { projectId },
      select: resourceSelect,
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(resources);
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project resources GET] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 }
    );
  }
}

const linkSchema = z.object({
  type: z.literal("LINK"),
  url: z.string().trim().min(1, "URL is required").max(2048),
  name: z.string().trim().max(255).optional(),
});

// POST /api/projects/:projectId/resources
// - multipart/form-data with `file` → upload a FILE resource
// - application/json { type:"LINK", url, name? } → add a LINK resource
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { projectId } = await params;
    await verifyProjectAccess(userId, projectId, { requireWrite: true });

    const last = await prisma.projectResource.findFirst({
      where: { projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (last?.position ?? -1) + 1;

    const contentType = req.headers.get("content-type") || "";

    // ── Link ──────────────────────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const data = linkSchema.parse(body);
      const raw = data.url.trim();
      // Detect a declared scheme. A real URL scheme has no dots
      // (RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) — but a bare
      // `host:port` also matches, and hosts DO contain dots), so treat a
      // pre-colon part WITH a dot as a host:port, not a scheme.
      const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):/i);
      const declaredScheme =
        schemeMatch && !schemeMatch[1].includes(".")
          ? schemeMatch[1].toLowerCase()
          : null;
      let url: string;
      if (declaredScheme) {
        // A declared scheme must be safe — never prepend https:// to a
        // javascript:/data:/vbscript: payload (which the old code did,
        // producing a stored `https://javascript:…` that slipped past the
        // check). Reject it outright.
        if (!["http", "https", "mailto"].includes(declaredScheme)) {
          return NextResponse.json({ error: "Invalid link" }, { status: 400 });
        }
        url = raw;
      } else {
        // No scheme (bare host, optionally host:port) → assume https.
        url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      }
      const name =
        data.name?.trim() || url.replace(/^https?:\/\//i, "").slice(0, 120);
      const resource = await prisma.projectResource.create({
        data: {
          projectId,
          uploaderId: userId,
          type: "LINK",
          name,
          url,
          position: nextPosition,
        },
        select: resourceSelect,
      });
      return NextResponse.json(resource, { status: 201 });
    }

    // ── File upload ───────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // uploadFile enforces the size cap, blocked extensions, and MIME/ext
    // allowlist — surface its message rather than a generic 500.
    let fileUrl: string;
    try {
      ({ url: fileUrl } = await uploadFile(file, `projects/${projectId}/resources`));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 400 }
      );
    }

    // Free the just-uploaded blob if the row can't be written (transient DB
    // error), or it lingers in storage forever with nothing referencing it.
    let resource;
    try {
      resource = await prisma.projectResource.create({
        data: {
          projectId,
          uploaderId: userId,
          type: "FILE",
          name: file.name,
          url: fileUrl,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          position: nextPosition,
        },
        select: resourceSelect,
      });
    } catch (e) {
      await deleteFile(fileUrl).catch((err) =>
        console.error("[project resources POST] orphan blob cleanup failed:", err)
      );
      throw e;
    }
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      const { status, message } = getErrorStatus(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error("[project resources POST] error:", error);
    return NextResponse.json(
      { error: "Failed to add resource" },
      { status: 500 }
    );
  }
}
