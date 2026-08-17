# Client Project Share Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each client a revocable, no-password link to their own project where they can see progress, answer what the firm needs from them, and hold a conversation with the firm.

**Architecture:** A new public route `/p/<token>` renders a purpose-built narrow projection of one project — never a filtered version of the internal page, because that page's only role checks gate editing rather than seeing and it serializes `Project.budget` to the browser on every tab. Access is a stored `ProjectShareLink` row keyed by the SHA-256 of a random token, so it can be listed, expired and revoked. Everything the client sees is opt-in per item.

**Tech Stack:** Next.js 16 (App Router, `src/proxy.ts` is the middleware), Prisma + PostgreSQL (`prisma db push`, this repo has no migrations folder), NextAuth v4 (JWT), Resend for email, Vercel Blob via `src/lib/storage.ts`, Vitest (added in Task 1 — the repo currently has no test runner).

**Source spec:** `docs/superpowers/specs/2026-08-17-client-project-share-link-design.md`

---

## Conventions for every task

- Work in an isolated worktree off `origin/master`, never in the main clone — it carries ~127 uncommitted files from other sessions. Create it with `superpowers:using-git-worktrees`.
- Before any push: `npm run build` must exit 0. `tsc` alone is not enough; Next catches Prisma include shapes that `tsc` misses.
- Schema changes: `npx prisma db push` then `npx prisma generate`. There is no `prisma/migrations` directory and this plan does not introduce one.
- **Stop `next dev` / `next start` before running a build.** A running server holds `node_modules/.prisma/client/query_engine-windows.dll.node` and `prisma generate` dies with `EPERM: rename`.
- Commit after every task.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/client-link/token.ts` | Mint, hash and verify share tokens. Pure, no DB. |
| `src/lib/client-link/projection.ts` | Build the exact client-visible payload from a project id. The only place that decides what a client sees. |
| `src/lib/client-link/requests.ts` | The `ClientRequest` state machine. Pure transition functions. |
| `src/lib/client-link/access.ts` | Resolve a token to a live link row; enforce revoked/expired; stamp `lastSeenAt`. DB-facing. |
| `src/app/p/[token]/page.tsx` | The public client page. Server component, no app shell. |
| `src/app/p/[token]/layout.tsx` | Minimal layout + `noindex` metadata. |
| `src/components/client-link/*.tsx` | The eight display blocks. Presentational only. |
| `src/app/api/p/[token]/respond/route.ts` | Client answers a request. |
| `src/app/api/p/[token]/message/route.ts` | Client posts to the thread. |
| `src/app/api/p/[token]/upload/route.ts` | Client uploads a file. |
| `src/app/api/projects/[projectId]/share-links/route.ts` | Staff: list + create. |
| `src/app/api/projects/[projectId]/share-links/[linkId]/route.ts` | Staff: revoke, extend, re-mint. |
| `src/app/api/projects/[projectId]/client-requests/route.ts` | Staff: create a request. |
| `src/components/projects/client-access-panel.tsx` | Staff UI on the project page. |
| `src/lib/email.ts` | Two new senders + the `APP_URL` production guard. |

---

## Task 1: Add a test runner

The repo has no automated tests. `tests/*.ts` are standalone QC scripts for the engineering calculators, not a suite. This feature mints credentials and gates access to client data, so its logic must be testable. Vitest is added because it needs no Babel config and reads `tsconfig` paths directly.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/client-link/token.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm i -D vitest@^3 @vitest/coverage-v8 vite-tsconfig-paths
```

- [ ] **Step 2: Create the config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Only unit-level suites. Nothing here may touch the database:
    // DATABASE_URL points at production and this repo has no test DB.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the script**

In `package.json` `scripts`, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write a failing placeholder test**

Create `src/lib/client-link/token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mintToken } from "./token";

describe("mintToken", () => {
  it("returns a 64-character hex token and its sha256 hash", () => {
    const { token, tokenHash } = mintToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toBe(token);
  });
});
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./token"`.

- [ ] **Step 6: Commit the harness**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/client-link/token.test.ts
git commit -m "test: add vitest, with a failing first test for the share token"
```

---

## Task 2: BLOCKING FIX — the Share dialog must not mint client MEMBERs

`src/app/api/projects/[projectId]/members/route.ts:124` hard-codes workspace role `MEMBER` for an invitee. `src/proxy.ts:263` only redirects `CLIENT`, so such a person reaches the full internal cockpit — budget, workload, notes, messages, other clients' portfolios. `ProjectMember.role` also defaults to `EDITOR` (`prisma/schema.prisma:567`), which satisfies `canWrite` (`src/lib/project-access.ts:149`).

**Files:**
- Modify: `src/app/api/projects/[projectId]/members/route.ts:124`
- Modify: `src/components/projects/project-share-dialog.tsx`

- [ ] **Step 1: Read the invite handler**

Run: `sed -n '100,140p' src/app/api/projects/[projectId]/members/route.ts`
Note the exact shape of the `workspaceMember.create`/`upsert` call before editing.

- [ ] **Step 2: Reject client-shaped invitations at the API**

In the invite handler, before creating the workspace member, add:

```ts
// Clients never enter through this dialog. They get a scoped share link
// (/p/<token>) instead. Minting a workspace MEMBER here put them on the
// internal cockpit, because src/proxy.ts only redirects role CLIENT.
if (body.role === "CLIENT" || body.isClient === true) {
  return NextResponse.json(
    {
      error:
        "Clients are given a project link, not workspace access. Use “Client access” on the project page.",
    },
    { status: 400 }
  );
}
```

- [ ] **Step 3: Remove the client option from the dialog**

In `src/components/projects/project-share-dialog.tsx`, delete any `CLIENT` entry from the role picker options and add above it:

```tsx
{/* No client option here by design — see the guard in
    api/projects/[projectId]/members/route.ts. Clients get /p/<token>. */}
```

- [ ] **Step 4: Verify no client path remains**

Run: `grep -rn "CLIENT" src/components/projects/project-share-dialog.tsx`
Expected: no match other than the comment.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/\[projectId\]/members/route.ts src/components/projects/project-share-dialog.tsx
git commit -m "fix(security): clients can no longer be invited as workspace members"
```

---

## Task 3: BLOCKING FIX — PUBLIC visibility must not bypass the workspace filter

`src/app/(dashboard)/projects/[projectId]/page.tsx:85` fetches the project by id with **no** `workspaceId` filter, and `:156` lets `visibility === "PUBLIC"` short-circuit the gate. The same rule lives in `src/lib/project-access.ts:91`. Any authenticated user of any workspace can therefore open a PUBLIC project, and a project EDITOR can set `visibility` via PATCH (`src/app/api/projects/[projectId]/route.ts:184`).

**Files:**
- Modify: `src/lib/project-access.ts:91`
- Modify: `src/app/(dashboard)/projects/[projectId]/page.tsx:85`
- Modify: `src/app/api/projects/[projectId]/route.ts:184`

- [ ] **Step 1: Scope PUBLIC to the owning workspace**

In `src/lib/project-access.ts`, change the PUBLIC branch so it also requires the viewer to be in the project's workspace:

```ts
// PUBLIC means "everyone in THIS workspace", never "everyone with an account".
// Without the workspace comparison this granted cross-tenant read.
if (project.visibility === "PUBLIC" && viewerWorkspaceIds.includes(project.workspaceId)) {
  return { allowed: true, canWrite: false };
}
```

- [ ] **Step 2: Filter the page query by workspace**

In `src/app/(dashboard)/projects/[projectId]/page.tsx`, add `workspaceId: { in: viewerWorkspaceIds }` to the `where` of the project lookup at line ~85.

- [ ] **Step 3: Restrict who can change visibility**

In `src/app/api/projects/[projectId]/route.ts`, before applying a `visibility` change in PATCH:

```ts
if (body.visibility !== undefined && !access.canManageMembers) {
  return NextResponse.json(
    { error: "Only a project admin can change visibility" },
    { status: 403 }
  );
}
```

- [ ] **Step 4: Require write access to duplicate a project**

Spec §11.3. `src/app/api/projects/[projectId]/duplicate/route.ts:37` calls
`verifyProjectAccess` without `requireWrite`, so read access is enough to fork a
whole project — and the copier owns the copy. Change that call to:

```ts
const access = await verifyProjectAccess(projectId, userId, { requireWrite: true });
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git commit -am "fix(security): PUBLIC visibility no longer crosses workspaces; duplicate requires write"
```

---

## Task 4: Schema — the share link and the two visibility flags

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model and flags**

Append to `prisma/schema.prisma`:

```prisma
/// A revocable, no-password way into ONE project for ONE client contact.
/// The plaintext token is never stored — only its SHA-256 — so the full URL
/// can be shown once at creation and never recovered from the database.
model ProjectShareLink {
  id          String    @id @default(cuid())
  tokenHash   String    @unique
  projectId   String
  label       String
  email       String?
  createdById String
  expiresAt   DateTime
  revokedAt   DateTime?
  lastSeenAt  DateTime?
  viewCount   Int       @default(0)
  createdAt   DateTime  @default(now())

  project   Project @relation("ProjectShareLinks", fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User    @relation("CreatedShareLinks", fields: [createdById], references: [id])

  requests ClientRequest[]
  messages ClientMessage[]
  uploads  ClientUpload[]

  @@index([projectId])
  @@index([tokenHash])
}
```

Add to `model File`:

```prisma
  /// Opt-in. Nothing reaches a client share link unless this is true.
  sharedWithClient Boolean @default(false)
```

Add to `model StatusUpdate`:

```prisma
  /// A narrative written deliberately FOR the client. Never derived from
  /// `summary`/`sections`, which carry the internal "What's blocked" block.
  clientSummary String?
```

Add the back-relations on `Project` and `User`:

```prisma
  // model Project
  shareLinks ProjectShareLink[] @relation("ProjectShareLinks")

  // model User
  createdShareLinks ProjectShareLink[] @relation("CreatedShareLinks")
```

- [ ] **Step 2: Push and generate**

Run: `npx prisma db push && npx prisma generate`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(db): ProjectShareLink plus per-item client visibility flags"
```

---

## Task 5: The token module

**Files:**
- Create: `src/lib/client-link/token.ts`
- Test: `src/lib/client-link/token.test.ts` (created in Task 1)

- [ ] **Step 1: Write the implementation**

Create `src/lib/client-link/token.ts`:

```ts
import crypto from "crypto";

/** URL segment length in bytes before hex encoding. */
const TOKEN_BYTES = 32;

/**
 * Mint a share token. Returns the plaintext for the URL and the hash to store.
 *
 * The plaintext is deliberately not recoverable: `src/lib/tokens.ts` stores
 * verification tokens in plaintext, which the auth audit flagged, and new
 * surface should not inherit that. The cost is that a link can be shown once
 * and then only re-minted — which is the semantics we want anyway, since
 * re-sending to a new board president must kill the former one's link.
 */
export function mintToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time compare of two hex hashes of equal length. */
export function hashesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** A token is well-formed if it is exactly the hex we mint. Cheap pre-filter. */
export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{64}$/.test(token);
}
```

- [ ] **Step 2: Extend the test**

Append to `src/lib/client-link/token.test.ts`:

```ts
import { hashToken, hashesMatch, isWellFormedToken } from "./token";

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });
  it("differs for different input", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("hashesMatch", () => {
  it("matches identical hashes", () => {
    const h = hashToken("x");
    expect(hashesMatch(h, h)).toBe(true);
  });
  it("rejects different hashes", () => {
    expect(hashesMatch(hashToken("x"), hashToken("y"))).toBe(false);
  });
  it("rejects a length mismatch without throwing", () => {
    expect(hashesMatch(hashToken("x"), "abcd")).toBe(false);
  });
});

describe("isWellFormedToken", () => {
  it("accepts a minted token", () => {
    expect(isWellFormedToken(mintToken().token)).toBe(true);
  });
  it.each([null, 42, "", "zz", "A".repeat(64)])("rejects %p", (bad) => {
    expect(isWellFormedToken(bad)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: PASS, 9 tests.

- [ ] **Step 4: Commit**

```bash
git add src/lib/client-link/token.ts src/lib/client-link/token.test.ts
git commit -m "feat(client-link): share token mint, hash and constant-time compare"
```

---

## Task 6: Resolve a token to a live link

**Files:**
- Create: `src/lib/client-link/access.ts`

- [ ] **Step 1: Write it**

Create `src/lib/client-link/access.ts`:

```ts
import prisma from "@/lib/prisma";
import { hashToken, isWellFormedToken } from "./token";

export type ResolvedLink = {
  id: string;
  projectId: string;
  label: string;
};

/**
 * Resolve a URL token to a live link, or null.
 *
 * Null covers unknown, revoked AND expired on purpose: the route answers 404
 * for all three so it never confirms that a link once existed. Revocation and
 * expiry are re-checked on EVERY request, not only the first.
 */
export async function resolveShareLink(token: unknown): Promise<ResolvedLink | null> {
  if (!isWellFormedToken(token)) return null;

  const link = await prisma.projectShareLink.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, projectId: true, label: true, revokedAt: true, expiresAt: true },
  });

  if (!link) return null;
  if (link.revokedAt) return null;
  if (link.expiresAt.getTime() <= Date.now()) return null;

  return { id: link.id, projectId: link.projectId, label: link.label };
}

/** Fire-and-forget view accounting. Never blocks or fails the render. */
export async function recordVisit(linkId: string): Promise<void> {
  try {
    await prisma.projectShareLink.update({
      where: { id: linkId },
      data: { lastSeenAt: new Date(), viewCount: { increment: 1 } },
    });
  } catch {
    // A failed counter must never take the page down for the client.
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/client-link/access.ts
git commit -m "feat(client-link): resolve a token to a live, unrevoked, unexpired link"
```

---

## Task 7: The narrow projection

This module is the single place that decides what a client sees. Nothing else on the public route may query the project.

**Files:**
- Create: `src/lib/client-link/projection.ts`
- Create: `src/lib/client-link/projection.test.ts`

- [ ] **Step 1: Write the failing shape test**

Create `src/lib/client-link/projection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLIENT_PROJECT_SELECT, WITHHELD_FIELDS } from "./projection";

describe("CLIENT_PROJECT_SELECT", () => {
  it("selects only client-safe project fields", () => {
    expect(Object.keys(CLIENT_PROJECT_SELECT).sort()).toEqual(
      ["endDate", "gate", "id", "location", "name", "projectNumber", "startDate", "type"].sort()
    );
  });

  it.each(WITHHELD_FIELDS)("never selects %s", (field) => {
    expect(CLIENT_PROJECT_SELECT).not.toHaveProperty(field);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test`
Expected: FAIL — cannot resolve `./projection`.

- [ ] **Step 3: Write the projection**

Create `src/lib/client-link/projection.ts`:

```ts
import prisma from "@/lib/prisma";

/**
 * Fields that must never appear in a client payload. Asserted by the test so
 * that adding one to the select below breaks the build rather than the client.
 */
export const WITHHELD_FIELDS = [
  "budget",
  "currency",
  "status",
  "notes",
  "workspaceId",
  "visibility",
  "clientName",
] as const;

/** The ONLY project fields a share link may read. */
export const CLIENT_PROJECT_SELECT = {
  id: true,
  name: true,
  projectNumber: true,
  type: true,
  location: true,
  startDate: true,
  endDate: true,
  gate: true,
} as const;

export type ClientProjectView = {
  project: {
    id: string;
    name: string;
    projectNumber: string | null;
    type: string | null;
    location: string | null;
    startDate: Date | null;
    endDate: Date | null;
    gate: string | null;
  };
  milestones: { id: string; name: string; dueDate: Date | null; completed: boolean }[];
  documents: { id: string; name: string; url: string; size: number; createdAt: Date }[];
  latestUpdate: { body: string; createdAt: Date } | null;
  contacts: { name: string; role: string }[];
};

export async function buildClientProjectView(projectId: string): Promise<ClientProjectView | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: CLIENT_PROJECT_SELECT,
  });
  if (!project) return null;

  const milestones = await prisma.task.findMany({
    // isPrivate is enforced in exactly ONE other place in the whole API
    // (src/app/api/ai/assist/route.ts:169), so it must be explicit here.
    where: { projectId, type: "MILESTONE", isPrivate: false },
    select: { id: true, name: true, dueDate: true, completed: true },
    orderBy: { dueDate: "asc" },
  });

  const documents = await prisma.file.findMany({
    where: { projectId, sharedWithClient: true },
    select: { id: true, name: true, url: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const update = await prisma.statusUpdate.findFirst({
    where: { projectId, clientSummary: { not: null } },
    select: { clientSummary: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const members = await prisma.projectMember.findMany({
    where: { projectId, showToClient: true },
    select: { role: true, user: { select: { name: true } } },
    take: 2,
  });

  return {
    project,
    milestones,
    documents,
    latestUpdate: update?.clientSummary
      ? { body: update.clientSummary, createdAt: update.createdAt }
      : null,
    // Name and role only. Never an email address, on any route.
    contacts: members.map((m) => ({ name: m.user.name ?? "Tercero Tablada", role: m.role })),
  };
}
```

- [ ] **Step 4: Add the `showToClient` flag used above**

In `prisma/schema.prisma`, add to `model ProjectMember`:

```prisma
  /// Opt-in per membership. Deriving contacts from project role would leak the
  /// roster the moment anyone is added to the job.
  showToClient Boolean @default(false)
```

Run: `npx prisma db push && npx prisma generate`

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add prisma/schema.prisma src/lib/client-link/projection.ts src/lib/client-link/projection.test.ts
git commit -m "feat(client-link): narrow client projection with a withheld-field guard"
```

---

## Task 8: Schema — requests, messages and uploads

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enums and models**

Append the three models and two enums exactly as written in spec §5.2 (`docs/superpowers/specs/2026-08-17-client-project-share-link-design.md`), plus the back-relations on `Project`, `User` and `Task`:

```prisma
  // model Project
  clientRequests ClientRequest[]
  clientMessages ClientMessage[]
  clientUploads  ClientUpload[]

  // model User
  createdClientRequests ClientRequest[] @relation("CreatedClientRequests")
  clientMessagesSent    ClientMessage[] @relation("ClientMessagesSent")

  // model Task
  clientRequests ClientRequest[]
```

- [ ] **Step 2: Push, generate, build**

```bash
npx prisma db push && npx prisma generate && npm run build
```

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(db): ClientRequest, ClientMessage and ClientUpload"
```

---

## Task 9: The request state machine

**Files:**
- Create: `src/lib/client-link/requests.ts`
- Create: `src/lib/client-link/requests.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/client-link/requests.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyClientResponse } from "./requests";

const base = { kind: "DOCUMENT" as const, status: "OPEN" as const };

describe("applyClientResponse", () => {
  it("marks a document request answered when files arrive", () => {
    const r = applyClientResponse({ ...base }, { action: "UPLOADED", fileCount: 1 });
    expect(r.status).toBe("ANSWERED");
    expect(r.respondedAt).toBeInstanceOf(Date);
  });

  it("refuses an upload response with no files", () => {
    expect(() => applyClientResponse({ ...base }, { action: "UPLOADED", fileCount: 0 })).toThrow();
  });

  it("accepts a proposed date", () => {
    const r = applyClientResponse(
      { kind: "DATE_CONFIRMATION", status: "OPEN" },
      { action: "ACCEPT" }
    );
    expect(r.status).toBe("ACCEPTED");
  });

  it("records a counter-proposed date as DECLINED", () => {
    const when = new Date("2026-09-01");
    const r = applyClientResponse(
      { kind: "DATE_CONFIRMATION", status: "OPEN" },
      { action: "COUNTER", date: when, note: "that week we are closed" }
    );
    expect(r.status).toBe("DECLINED");
    expect(r.clientProposedDate).toEqual(when);
    expect(r.responseNote).toBe("that week we are closed");
  });

  it("accepts an acknowledgement", () => {
    const r = applyClientResponse({ kind: "ACKNOWLEDGEMENT", status: "OPEN" }, { action: "ACCEPT" });
    expect(r.status).toBe("ACCEPTED");
  });

  it("refuses to answer a request that is not open", () => {
    expect(() =>
      applyClientResponse({ kind: "DOCUMENT", status: "ANSWERED" }, { action: "UPLOADED", fileCount: 1 })
    ).toThrow(/not open/i);
  });

  it("refuses an action that does not belong to the kind", () => {
    expect(() => applyClientResponse({ ...base }, { action: "ACCEPT" })).toThrow(/document/i);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test`
Expected: FAIL — cannot resolve `./requests`.

- [ ] **Step 3: Implement**

Create `src/lib/client-link/requests.ts`:

```ts
export type RequestKind = "DOCUMENT" | "DATE_CONFIRMATION" | "ACKNOWLEDGEMENT";
export type RequestStatus = "OPEN" | "ANSWERED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type ClientResponse =
  | { action: "UPLOADED"; fileCount: number }
  | { action: "ACCEPT" }
  | { action: "COUNTER"; date: Date; note?: string };

export type RequestPatch = {
  status: RequestStatus;
  respondedAt: Date;
  clientProposedDate?: Date;
  responseNote?: string;
};

/**
 * Decide the new state of a request from the client's answer.
 *
 * Pure on purpose: the route persists the patch, this decides it, and the
 * table of legal transitions is testable without a database.
 * `respondedAt` is set on EVERY path — the existing portal never writes the
 * equivalent timestamp (api/client/approvals/route.ts:105) and that stamp is
 * the record of when the client actually answered.
 */
export function applyClientResponse(
  request: { kind: RequestKind; status: RequestStatus },
  response: ClientResponse
): RequestPatch {
  if (request.status !== "OPEN") {
    throw new Error("This request is not open.");
  }

  const respondedAt = new Date();

  if (response.action === "UPLOADED") {
    if (request.kind !== "DOCUMENT") throw new Error("Only a DOCUMENT request accepts an upload.");
    if (response.fileCount < 1) throw new Error("An upload response needs at least one file.");
    return { status: "ANSWERED", respondedAt };
  }

  if (response.action === "ACCEPT") {
    if (request.kind === "DOCUMENT") {
      throw new Error("A document request is answered by uploading, not by accepting.");
    }
    return { status: "ACCEPTED", respondedAt };
  }

  if (request.kind !== "DATE_CONFIRMATION") {
    throw new Error("Only a date request can be countered.");
  }
  return {
    status: "DECLINED",
    respondedAt,
    clientProposedDate: response.date,
    responseNote: response.note,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS, 7 new tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client-link/requests.ts src/lib/client-link/requests.test.ts
git commit -m "feat(client-link): request state machine with respondedAt on every path"
```

---

## Task 10: Make `/p/` public and non-indexable

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/robots.ts`
- Create: `src/app/p/[token]/layout.tsx`

- [ ] **Step 1: Add the prefix**

In `src/proxy.ts`, inside `publicPrefixes`, add after `"/onboarding"`:

```ts
  // Client share links. The route handler is the gate: it resolves a stored,
  // unrevoked, unexpired link row. There is no session by design.
  "/p/",
  "/api/p/",
```

- [ ] **Step 2: Disallow in robots**

In `src/app/robots.ts`, add `"/p/"` to the `disallow` array.

- [ ] **Step 3: Create the layout**

Create `src/app/p/[token]/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Deliberately bare: no app shell, no nav, no session provider chrome. */
export default function ClientLinkLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f7f7f5]">{children}</div>;
}
```

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/proxy.ts src/app/robots.ts src/app/p/\[token\]/layout.tsx
git commit -m "feat(client-link): public, noindex route shell at /p/<token>"
```

---

## Task 11: The public page

**Files:**
- Create: `src/app/p/[token]/page.tsx`
- Create: `src/components/client-link/stage-stepper.tsx`
- Create: `src/components/client-link/milestone-list.tsx`
- Create: `src/components/client-link/request-list.tsx`
- Create: `src/components/client-link/document-list.tsx`
- Create: `src/components/client-link/thread.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/p/[token]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { resolveShareLink, recordVisit } from "@/lib/client-link/access";
import { buildClientProjectView } from "@/lib/client-link/projection";
import { StageStepper } from "@/components/client-link/stage-stepper";
import { MilestoneList } from "@/components/client-link/milestone-list";
import { RequestList } from "@/components/client-link/request-list";
import { DocumentList } from "@/components/client-link/document-list";
import { Thread } from "@/components/client-link/thread";

export default async function ClientLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const link = await resolveShareLink(token);
  // 404 for unknown, revoked AND expired alike — never confirm a link existed.
  if (!link) notFound();

  const view = await buildClientProjectView(link.projectId);
  if (!view) notFound();

  const [requests, messages] = await Promise.all([
    prisma.clientRequest.findMany({
      where: { shareLinkId: link.id },
      select: {
        id: true, kind: true, title: true, detail: true, status: true,
        dueDate: true, proposedDate: true, respondedAt: true,
        uploads: { select: { id: true, name: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientMessage.findMany({
      where: { shareLinkId: link.id },
      select: {
        id: true, body: true, fromFirm: true, createdAt: true,
        uploads: { select: { id: true, name: true, url: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  await recordVisit(link.id);

  const open = requests.filter((r) => r.status === "OPEN");
  // Spec §6.4: the "done" group is a requirement. A client who uploads into a
  // form that then shows nothing emails to ask whether it arrived — the call
  // this feature exists to remove. The receipt is the point.
  const done = requests.filter((r) => r.status !== "OPEN" && r.status !== "CANCELLED").slice(0, 5);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-10">
      <header>
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          {view.project.projectNumber}
        </p>
        <h1 className="text-3xl font-semibold">{view.project.name}</h1>
        <p className="text-sm text-neutral-600">
          {[view.project.type, view.project.location].filter(Boolean).join(" · ")}
        </p>
      </header>

      <StageStepper gate={view.project.gate} />
      <RequestList token={token} open={open} done={done} />
      <MilestoneList milestones={view.milestones} />
      {view.latestUpdate && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide">Latest update</h2>
          <p className="mt-2 whitespace-pre-line text-neutral-800">{view.latestUpdate.body}</p>
        </section>
      )}
      <DocumentList documents={view.documents} />
      {view.contacts.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide">Your contacts</h2>
          <ul className="mt-2 text-sm">
            {view.contacts.map((c) => (
              <li key={c.name}>{c.name} — {c.role}</li>
            ))}
          </ul>
        </section>
      )}
      <Thread token={token} messages={messages} />
    </main>
  );
}
```

- [ ] **Step 2: Create the five presentational components**

Each takes only the props shown above and renders them. `StageStepper` maps `ProjectGate` to the five labels already written at `src/components/cockpit/types.ts:124` and marks the current one — no percentage, no status pill, per spec §2 decision 3. `RequestList` renders the open group with a response control per `kind` and the done group collapsed with what was sent and when. `Thread` renders the messages and a compose box posting to `/api/p/<token>/message`.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/p src/components/client-link
git commit -m "feat(client-link): the client-facing project page"
```

---

## Task 12: Client write endpoints

**Files:**
- Create: `src/app/api/p/[token]/respond/route.ts`
- Create: `src/app/api/p/[token]/message/route.ts`
- Create: `src/app/api/p/[token]/upload/route.ts`

- [ ] **Step 1: The respond route**

Every one of the three routes begins with the same four lines, and none of them may accept a `projectId` from the caller:

```ts
const { token } = await params;
const link = await resolveShareLink(token);
if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
const limited = rateLimit(`client-link:${link.id}`, 30, 10 * 60 * 1000);
if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
```

`respond` then loads the request **scoped to `shareLinkId: link.id`**, calls `applyClientResponse`, and persists the returned patch. Any thrown error becomes a 400 with its message.

- [ ] **Step 2: The upload route**

Uses the hardened uploader rather than a new one:

```ts
const form = await request.formData();
const file = form.get("file");
if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

// uploadFile returns { url, pathname } — NOT size/mimeType. Those come off the
// File itself. Verified against src/lib/storage.ts:38.
const { url } = await uploadFile(file, `client-uploads/${link.projectId}`);

await prisma.clientUpload.create({
  data: {
    projectId: link.projectId,
    shareLinkId: link.id,
    requestId,
    name: file.name,
    url,
    size: file.size,
    mimeType: file.type,
  },
});
```

`uploadFile` already enforces the 10 MB cap (`src/lib/storage.ts:68`) and the
MIME allowlist (`:26-53`) and throws on violation — catch and return 400. Do not
duplicate those lists.

- [ ] **Step 3: Replace the client-documents stub**

Spec §11.4. `src/app/api/client/documents/route.ts:94-105` writes a fake URL and
**discards the bytes**. Now that the real uploader is wired here, point that
route at `uploadFile` too rather than leaving a second, broken upload path in
the codebase.

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/app/api/p src/app/api/client/documents/route.ts
git commit -m "feat(client-link): client respond, message and upload endpoints"
```

---

## Task 13: Email senders and the APP_URL guard

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/lib/client-link/app-url.test.ts`

- [ ] **Step 1: Write the failing guard test**

```ts
import { describe, expect, it } from "vitest";
import { requireAppUrl } from "@/lib/email";

describe("requireAppUrl", () => {
  it("throws on a localhost value in production", () => {
    expect(() => requireAppUrl("http://localhost:3000", "production")).toThrow(/localhost/i);
  });
  it("allows localhost outside production", () => {
    expect(requireAppUrl("http://localhost:3000", "development")).toBe("http://localhost:3000");
  });
  it("throws when unset in production", () => {
    expect(() => requireAppUrl(undefined, "production")).toThrow();
  });
  it("returns a real url", () => {
    expect(requireAppUrl("https://app.ttcivilstructural.com", "production")).toBe(
      "https://app.ttcivilstructural.com"
    );
  });
});
```

- [ ] **Step 2: Implement and export it**

```ts
/**
 * APP_URL currently falls back to http://localhost:3000. A misconfigured
 * production deploy minting localhost links into real client email is worse
 * than a failed send, so in production this throws instead.
 */
export function requireAppUrl(value = process.env.APP_URL, env = process.env.NODE_ENV): string {
  if (env === "production") {
    if (!value) throw new Error("APP_URL is required in production");
    if (/localhost|127\.0\.0\.1/.test(value)) {
      throw new Error(`APP_URL points at localhost in production: ${value}`);
    }
  }
  return value ?? "http://localhost:3000";
}
```

- [ ] **Step 3: Add the two senders**

`sendClientLinkEmail({ to, projectName, url, label })` and `sendClientRequestEmail({ to, projectName, requests, url })`, both modelled on `sendInvitationEmail` (`src/lib/email.ts:132`) and both calling `requireAppUrl()` to build the URL.

- [ ] **Step 4: Test, build, commit**

```bash
npm test && npm run build
git commit -am "feat(client-link): client emails with a production APP_URL guard"
```

---

## Task 14: Staff API and panel

**Files:**
- Create: `src/app/api/projects/[projectId]/share-links/route.ts`
- Create: `src/app/api/projects/[projectId]/share-links/[linkId]/route.ts`
- Create: `src/app/api/projects/[projectId]/client-requests/route.ts`
- Create: `src/components/projects/client-access-panel.tsx`
- Modify: `src/components/projects/project-content.tsx`

- [ ] **Step 1: The staff routes**

All three require `canManageMembers` on the project via the existing `verifyProjectAccess`. `POST /share-links` mints via `mintToken()`, stores only the hash, and returns the **plaintext once** in the response body. `PATCH /share-links/[linkId]` handles `{ action: "revoke" | "extend" | "remint" }`; `remint` mints a new token, replaces the hash, and returns the new URL once.

- [ ] **Step 2: The panel**

`client-access-panel.tsx` lists links with label, email, created, last seen, view count and expiry, plus Revoke / Re-send / Extend. On create it shows the URL once with a copy button and the sentence "This link will not be shown again. Re-send generates a new one and kills this."

- [ ] **Step 3: The reopen path**

Spec §7 requires it and no other task covers it. In
`src/app/api/projects/[projectId]/client-requests/[requestId]/route.ts`, accept
`{ action: "reopen", reason: string }`:

```ts
// A document arrived but was the wrong file, or the county moved an accepted
// date. Without this the only recourse is cancelling and creating a new
// request, which loses the history of what was already sent. Prior
// ClientUpload rows stay attached on purpose.
await prisma.clientRequest.update({
  where: { id: requestId },
  data: {
    status: "OPEN",
    respondedAt: null,
    clientProposedDate: null,
    detail: `${existing.detail ?? ""}\n\nReopened: ${reason}`.trim(),
  },
});
```

Guard it: only a request whose status is `ANSWERED`, `ACCEPTED` or `DECLINED`
may be reopened; a `CANCELLED` one may not.

- [ ] **Step 4: Mount the panel**

Render the panel in the project Overview, gated on `canManageMembers`.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git commit -am "feat(client-link): staff panel to create, revoke and re-send links"
```

---

## Task 15: Surface client replies internally

**Files:**
- Modify: the Files and Messages views under `src/components/views/`

- [ ] **Step 1: Add a "From the client" group**

Files view lists `ClientUpload` rows for the project in their own group; Messages view shows `ClientMessage` rows with `fromFirm: false`. Both link back to the originating request.

- [ ] **Step 2: Build and commit**

```bash
npm run build
git commit -am "feat(client-link): client uploads and replies visible to the team"
```

---

## Task 16: End-to-end verification

- [ ] **Step 1: Full check**

```bash
npm test && npm run build
```

- [ ] **Step 2: Manual pass against a scratch project**

Create a link → open it in a private window → answer one request of each kind → upload a file → post a message → confirm each appears on the internal project page → revoke the link → confirm it 404s → confirm an expired link also 404s.

- [ ] **Step 3: Leak assertions on the live payload**

With the page open, confirm the served HTML contains no `budget`, no `@` in the contacts block, and no private milestone.

- [ ] **Step 4: Push**

```bash
git push origin HEAD:master
```
