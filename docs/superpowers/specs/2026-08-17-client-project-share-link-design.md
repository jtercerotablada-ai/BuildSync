# Client project link — design

**Date:** 2026-08-17
**Status:** approved by Juan, ready for an implementation plan
**Author:** Claude, from a six-agent study of the projects section (`wf_fac0ef2f-84b`)

---

## 1. The problem

Juan needs to give a client a way to see their own project and to answer what the
firm needs from them, by sending a link or an email invitation. The internal
project page cannot be that view.

It draws **12 tabs plus a 13th hidden `team` view** that has no tab but still
resolves via `?view=team` (`src/lib/project-views.ts:59`). More importantly, the
only role checks in the whole component — `canEditProject`, `canManageMembers` —
gate *editing*, never *seeing* (`src/components/projects/project-content.tsx:412`).
The decisive proof: `Project.budget` is serialized into the browser payload on
**every** tab, not only where it renders
(`src/app/(dashboard)/projects/[projectId]/page.tsx:224`). Hiding the chip in
markup would not remove the number from what the browser received.

Conclusion, and the governing principle of this design:

> **Build a new narrow projection. Do not filter the existing one.**
> A page that only ever reads eight things cannot over-return, because it never
> held the rest.

## 2. Decisions already taken

| # | Decision | Who | Why |
|---|---|---|---|
| 1 | Access is a **stored, revocable link**, not a stateless signature and not a password account | Juan | Condo boards rotate yearly; when a board president changes, Juan must cut that one link without touching the others. A pure signature cannot be revoked or listed. |
| 2 | Visibility is an **explicit per-item allowlist** | Claude | Every existing default is fail-open: `Comment.visibility` defaults to EXTERNAL (`prisma/schema.prisma:1030`), and `File`, `Attachment`, `Message`, `ProjectNote`, `StatusUpdate`, `ProjectBrief` have no visibility column at all. Publish-and-hide would make every future feature client-visible by default — which is the exact problem being fixed. |
| 3 | The client **never sees the internal status label** (`AT_RISK` / `OFF_TRACK`) or overdue counters | Juan | It is a candid judgement written for the team. Bad news reaches the client in a sentence Juan wrote, not a pill the system computed. |
| 4 | Scope is the **full two-way loop**, plus a conversation thread — not a read-only v1 | Juan | "Quiero que funcione al 100% para gestionar proyectos y tener comunicación fluida." A read-only window serves the client; the ask loop and the thread serve the firm. |

## 3. Out of scope

- The existing login portal under `src/app/(client)/`. It keeps its known leaks
  (see §10) and is not the primary path. Fixing it is a separate piece of work.
- Any list of projects. **One link, one project** — multi-row contexts are where
  cross-client leakage lives (`src/app/(dashboard)/projects/all/page.tsx:539`
  prints another client's name on every adjacent row).
- Client-initiated scheduling beyond confirming or countering a date the firm
  proposed.
- Payments, invoices, fees of any kind.

## 4. Route and shape

Public route: **`/p/<token>`** on the app host.

- Added to `publicPrefixes` in `src/proxy.ts`.
- Its own minimal layout. It must NOT mount the app shell or the dashboard
  chrome.
- `robots: noindex, nofollow` in the route's metadata, and `/p/` added to the
  disallow list in `src/app/robots.ts`.
- Server-rendered. No client-side data fetching of project data.

## 5. Data model

All new. No existing model is modified except the two additive flags in §5.3.

### 5.1 `ProjectShareLink`

```prisma
model ProjectShareLink {
  id          String    @id @default(cuid())
  /// SHA-256 of the URL token. The plaintext token is NEVER stored.
  tokenHash   String    @unique
  projectId   String
  /// Who this link is for, in Juan's words: "Board president", "Owner rep".
  label       String
  /// Address it was emailed to, for the record and for re-sending.
  email       String?
  createdById String
  expiresAt   DateTime
  revokedAt   DateTime?
  lastSeenAt  DateTime?
  viewCount   Int       @default(0)
  createdAt   DateTime  @default(now())

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy User    @relation("CreatedShareLinks", fields: [createdById], references: [id])

  requests ClientRequest[]
  messages ClientMessage[]
  uploads  ClientUpload[]

  @@index([projectId])
  @@index([tokenHash])
}
```

**Token:** 32 random bytes from `crypto.randomBytes`, hex, used as the URL
segment. Stored as SHA-256. Lookup is by hash, so it is a single indexed query,
and the comparison is on the hash — no plaintext token exists server-side to
leak. This deliberately diverges from `src/lib/tokens.ts`, which stores
verification tokens in plaintext (flagged as a finding in the auth audit); new
surface should not inherit that.

**Consequence to accept:** the full URL can be shown only once, at creation.
"Re-send" **re-mints** the token and invalidates the previous one. That is the
correct semantics anyway — re-sending to a new board president must not leave
the former president's link alive.

**Default lifetime:** 90 days, renewable with one click. Chosen because a
recertification cycle runs months; 30 days would force Juan to regenerate three
times on one job.

### 5.2 `ClientRequest`, `ClientMessage`, `ClientUpload`

```prisma
enum ClientRequestKind {
  DOCUMENT            // "we need the property certificate"
  DATE_CONFIRMATION   // "we propose the inspection on 12 March"
  ACKNOWLEDGEMENT     // "the permit was submitted" — confirm you saw it
}

enum ClientRequestStatus {
  OPEN
  ANSWERED     // DOCUMENT: a file arrived
  ACCEPTED     // DATE_CONFIRMATION accepted, or ACKNOWLEDGEMENT confirmed
  DECLINED     // date countered — see responseNote and proposedByClient
  CANCELLED    // withdrawn by the firm
}

model ClientRequest {
  id          String              @id @default(cuid())
  projectId   String
  shareLinkId String
  kind        ClientRequestKind
  title       String
  detail      String?
  /// For DOCUMENT and ACKNOWLEDGEMENT: when the firm needs it by.
  dueDate     DateTime?
  /// For DATE_CONFIRMATION: the date the FIRM proposes.
  proposedDate DateTime?
  /// For DATE_CONFIRMATION when the client counters.
  clientProposedDate DateTime?
  status      ClientRequestStatus @default(OPEN)
  /// Optional anchor to the milestone or task this is about.
  taskId      String?
  responseNote String?
  respondedAt DateTime?
  createdById String
  createdAt   DateTime            @default(now())

  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shareLink ProjectShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  task      Task?            @relation(fields: [taskId], references: [id], onDelete: SetNull)
  createdBy User             @relation("CreatedClientRequests", fields: [createdById], references: [id])
  uploads   ClientUpload[]

  @@index([projectId])
  @@index([shareLinkId])
}

model ClientMessage {
  id          String    @id @default(cuid())
  projectId   String
  shareLinkId String
  body        String
  /// True when the firm wrote it, false when the client did.
  fromFirm    Boolean
  /// Set only when fromFirm is true.
  authorId    String?
  /// When the client last saw the thread, for an unread marker on both sides.
  readByFirmAt DateTime?
  createdAt   DateTime  @default(now())

  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shareLink ProjectShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  author    User?            @relation("ClientMessagesSent", fields: [authorId], references: [id])
  uploads   ClientUpload[]

  @@index([projectId])
  @@index([shareLinkId])
}

model ClientUpload {
  id          String   @id @default(cuid())
  projectId   String
  shareLinkId String
  requestId   String?
  messageId   String?
  name        String
  url         String
  size        Int
  mimeType    String
  createdAt   DateTime @default(now())

  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shareLink ProjectShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  request   ClientRequest?   @relation(fields: [requestId], references: [id], onDelete: SetNull)
  message   ClientMessage?   @relation(fields: [messageId], references: [id], onDelete: SetNull)

  @@index([projectId])
  @@index([shareLinkId])
}
```

**Why `ClientRequest` and not the existing `ClientApproval`.** `ClientApproval`
(`prisma/schema.prisma:1862`) requires `clientId` pointing at a **User**, and a
link holder has no account. It also has no date field. Binding the request to the
**link** rather than to a user is the shape this feature actually needs.
`ClientApproval` is left untouched for the login portal.

**Why `ClientUpload` and not `File`.** `File.uploaderId` is a required FK to
`User` (`prisma/schema.prisma:1077`) and a link holder is not a User. Widening
that column to nullable would ripple through every consumer of `File`. A separate
model keeps the change additive; the internal Files panel renders client uploads
as a distinct "From the client" group.

### 5.3 Two additive flags on existing models

```prisma
// model File
sharedWithClient Boolean @default(false)

// model StatusUpdate
/// A client-facing narrative written deliberately for the client link.
/// Separate from `summary`/`sections`, which contain the internal
/// "What's blocked" block and are never shown to a client.
clientSummary String?
```

Both default to withholding. Nothing reaches the link unless somebody ticked it.

## 6. What the client page shows

Eight blocks, in this order, all from one server-side query with an explicit
`select`. No `spread` of a Prisma object anywhere on this route.

1. **Project identity** — `name`, `projectNumber`, `type`, `location`,
   `startDate`, `endDate`.
2. **Stage stepper** — `ProjectGate`: PRE_DESIGN → DESIGN → PERMITTING →
   CONSTRUCTION → CLOSEOUT (`prisma/schema.prisma:707`), labels already written
   at `src/components/cockpit/types.ts:124`. This is the progress vocabulary,
   replacing the naive completed/total task percentage the current client area
   shows.
3. **Milestones** — `Task` where `type = MILESTONE` **and `isPrivate = false`**.
   Name, date, done-state only. No assignee, no priority.
4. **What we need from you** — `ClientRequest` rows in two groups:
   - **Open**, newest first, each with its response control (§7).
   - **Done**, the most recent 5 answered or accepted ones, collapsed, showing
     what was sent and when.

   The "done" group is a requirement, not decoration. Juan asked for it in the
   original brief — *"que él vea que se completó algo"*. A client who uploads a
   document into a form that then shows nothing has no way to know it arrived,
   and will email to ask, which is the phone call this feature exists to remove.
   The receipt is the point.
5. **Documents shared with you** — `File` where `sharedWithClient = true`.
6. **Latest update** — the most recent `StatusUpdate.clientSummary` that is not
   null. If none exists, the block is omitted entirely rather than falling back
   to the internal summary.
7. **Your contacts** — **name and role only, never email, never more than two.**
   Chosen explicitly, not derived: a `ProjectMember` is surfaced only when the
   firm ticks "show to client" on that membership. Deriving it from project role
   would leak the roster the moment somebody is added to the job, and the whole
   design principle is that nothing reaches the client without a deliberate tick.
   If nobody is ticked, the block is omitted and the conversation thread (§6.8)
   is the contact route.
8. **Conversation** — the `ClientMessage` thread, with a compose box and file
   attachment. This is the "comunicación fluida" half: the client can start a
   message, not only answer a request.

### Explicitly withheld

Budget, currency and everything derived from them (`% Comp` and `Health` on
`/projects/all` are earned-value figures computed from `Project.budget` at
`src/lib/pmi-metrics.ts:90` — publishing them would let a client back out the
firm's cost performance); estimated hours and per-person workload; the internal
`StatusUpdate.summary`/`sections`; `ProjectNote`; `ProjectBrief`; the internal
Messages tab; the activity feed and overdue counters; Gantt, dependencies and
"blocked by"; task assignee names and priority; any staff email address; the
`ProjectStatus` label; the participating-companies roster including AHJ contacts;
and any tab strip — gating is server-side on the route, never by hiding a tab.

## 7. The two-way loop

State machine per `kind`:

| kind | client action | result |
|---|---|---|
| `DOCUMENT` | uploads one or more files | `status = ANSWERED`, `respondedAt` set, `ClientUpload` rows created |
| `DATE_CONFIRMATION` | "That works" | `status = ACCEPTED`, `respondedAt` set |
| `DATE_CONFIRMATION` | "Propose another" + date + note | `status = DECLINED`, `clientProposedDate` and `responseNote` set |
| `ACKNOWLEDGEMENT` | "Got it" | `status = ACCEPTED`, `respondedAt` set |

`respondedAt` is written on **every** response path. The current portal never
writes `reviewedAt` on `ClientApproval` (`api/client/approvals/route.ts:105`) and
that timestamp is the record of when the client actually answered.

**The firm can reopen.** A `DOCUMENT` request whose upload was the wrong file, or
an accepted date the county then moved, returns to `OPEN` with the reason
appended to `detail`. Without this the only recourse is cancelling and creating a
new request, which loses the history of what was already sent. Reopening keeps
the prior `ClientUpload` rows attached.

Uploads go through **`src/lib/storage.ts`** — the hardened uploader already in
production use by the forms path. It is not reimplemented. This also supersedes
the client-documents stub, which today writes a fake URL and discards the bytes
(`src/app/api/client/documents/route.ts:94-105`).

## 8. Staff side

On the internal project page, a **"Client access"** panel:

- Create a link: label, optional email, expiry (default 90 days).
- The full URL is displayed **once**, with a copy button and a clear note that it
  will not be shown again.
- Table of existing links: label, email, created, last seen, view count, expiry,
  and **Revoke** / **Re-send** (re-mint) / **Extend**.
- A **"Request from client"** action: pick kind, title, detail, date or due date,
  optionally anchor to a milestone. Creates the `ClientRequest` and emails the
  link holder.
- Client replies and uploads surface in the project's existing Files and Messages
  areas as a distinct "From the client" group, so the team sees them without
  visiting a separate screen.

## 9. Email

Two new senders in `src/lib/email.ts`, modelled on `sendInvitationEmail`
(`src/lib/email.ts:142`), which is the working plumbing:

- `sendClientLinkEmail(to, projectName, url, label)`
- `sendClientRequestEmail(to, projectName, requests[], url)`

**Required guard:** `APP_URL` currently falls back to `http://localhost:3000`
(`src/lib/email.ts:12`). Both senders must throw rather than send if `APP_URL` is
absent or points at localhost while `NODE_ENV === "production"`. A misconfigured
deploy minting localhost links into real client email is worse than a failed send.

There is no in-app notification channel for clients — `NotificationType` has no
client-directed member (`prisma/schema.prisma:1205`) and the bell is inert. Email
is the channel; that is a deliberate acceptance, not an oversight.

## 10. Security requirements

These are requirements, not suggestions. Each maps to something the study found
already broken elsewhere in the codebase.

1. The public route resolves the project **only** through the link row. It never
   queries by `projectId` taken from the URL. Contrast
   `src/app/(dashboard)/projects/[projectId]/page.tsx:85`, which fetches by id
   with no workspace filter.
2. `revokedAt` and `expiresAt` are checked on **every** request, not only the
   first.
3. Token lookup by `tokenHash`; constant-time compare.
4. Rate limit the public route and every write it accepts, keyed on the link id
   and on IP. `/api/users/onboarding` is currently the only unauthenticated auth
   endpoint with no limiter, and this route must not become the second.
5. Explicit `select` on every query. No `...project` spread. Contrast
   `src/app/api/projects/[projectId]/route.ts:145` and
   `src/app/(portal)/portal/projects/[projectId]/page.tsx:123`, which spread the
   whole row including `budget` and the deprecated 100 KB `notes` column.
6. Uploads: size and MIME allowlist enforced server-side via `src/lib/storage.ts`
   (`src/lib/storage.ts:26-53` already holds the lists). Never trust a
   client-declared mime type.
7. Milestone query filters `isPrivate`. `Task.isPrivate` is currently enforced in
   exactly one place in the whole API (`src/app/api/ai/assist/route.ts:169`), so
   the flag gives false assurance everywhere else.
8. `noindex` on the page and `/p/` disallowed in `robots.ts`.
9. Nothing on this route returns an email address, ever.

## 11. Pre-existing leaks this work must also close

Items 1 and 2 are **blocking** — they are live today, they are about client
access specifically, and shipping a careful client link while they stand would be
theatre. Items 3 and 4 are included because they are cheap and adjacent; if
either turns out not to be, it moves to its own change rather than delaying this
one.

Two are urgent because they are live and reachable today:

1. **Inviting a client from the project Share dialog makes them a workspace
   `MEMBER`, not `CLIENT`** (`src/app/api/projects/[projectId]/members/route.ts:124`),
   and `src/proxy.ts:263` only redirects `CLIENT`. Such a person lands on the full
   internal cockpit. Worse, `ProjectMember.role` defaults to `EDITOR`
   (`prisma/schema.prisma:567`), which satisfies `canWrite`
   (`src/lib/project-access.ts:149`) — they can edit tasks and PATCH the project.
   **Fix:** the Share dialog must not be a client path. Either force role
   `CLIENT` + `VIEWER` when the invitee is marked as a client, or remove clients
   from that dialog entirely and route them to the new link.
2. **`visibility === "PUBLIC"` short-circuits the project gate**
   (`src/app/(dashboard)/projects/[projectId]/page.tsx:156`,
   `src/lib/project-access.ts:91`) while the project is fetched by id with **no
   `workspaceId` filter** (`:85`) — any authenticated user of any workspace can
   open it, and a project EDITOR can set `visibility` via PATCH
   (`src/app/api/projects/[projectId]/route.ts:184`). **Fix:** always filter by
   workspace, and restrict who may set `visibility`.

Also fixed as part of this work, because the new feature would otherwise inherit
them:

3. `POST /api/projects/[projectId]/duplicate` calls `verifyProjectAccess` without
   `requireWrite` (`duplicate/route.ts:37`) — read access forks the project.
4. The client-documents upload stub is replaced by the real uploader (§7).

## 12. Testing

- **Unit:** token mint/hash/compare; the `ClientRequest` state machine for all
  four transitions in §7; the `APP_URL` guard throwing on a localhost value under
  production.
- **Route:** the public route returns 404 (not 403 — do not confirm the link ever
  existed) for an unknown, revoked or expired token; returns 200 for a valid one;
  and its payload contains none of the withheld fields in §6. Assert the absence
  of `budget`, of any `@` character in serialized contacts, and of any private
  milestone.
- **Integration, end to end:** create link → open it → answer one request of each
  kind → confirm the firm sees each response on the internal project page →
  revoke → confirm the link 404s.
- **Regression:** a private MILESTONE task must not appear on the client page.
- The `npm run build` gate from CLAUDE.md applies before any push.

## 13. Open items, deliberately deferred

- The login portal under `src/app/(client)/` keeps its leaks: `/client/documents`
  returns every `File` row with a direct URL
  (`src/app/api/client/documents/route.ts:30`), the client project detail ships
  every member's email (`client/projects/[projectId]/page.tsx:90-97`), and
  `canApprove` / `canComment` are accepted but never enforced
  (`api/client/approvals/route.ts:94`, `api/client/messages/route.ts:106`).
- The client invitation flow is broken in two places: no email is ever sent
  (`api/admin/clients/route.ts:1-4` imports no mail module) and accepting never
  creates the `ClientProjectAccess` row, despite the route claiming it will
  (`:178`).
- `Comment.visibility` has an `INTERNAL_NOTE` value that is never written
  anywhere, so the one working visibility filter on the form-tracking surface is
  a no-op today.
