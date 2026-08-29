-- Teams: make "Archive" real, and make "Membership by request" real.
--
-- Both existed in the UI and neither existed in the database. "Archive team"
-- PATCHed {archived:true} to a route whose schema has no such key, so zod
-- stripped it, the update ran with an empty data object, the response was 200,
-- and the modal reported "Team archived" and redirected home — with the row
-- untouched. "Membership by request" was stored on the team and then ignored:
-- the join route treats it exactly like PUBLIC, so nobody ever requested
-- anything.
--
-- APPLIED BY HAND with `prisma db execute`. This database is AHEAD of
-- schema.prisma and `prisma db push` would DROP populated columns; every
-- statement here is additive and idempotent.

-- ── 1. Archive ──────────────────────────────────────────────────────────────
-- Mirrors Project.isArchived (Boolean @default(false)), which the project
-- archive shipped 2026-08-27 already uses, so the two read the same way.
-- archivedAt is what lets the UI say WHEN, which a plain flag cannot.
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Listing filters on it on every teams screen.
CREATE INDEX IF NOT EXISTS "Team_workspaceId_isArchived_idx"
  ON "Team" ("workspaceId", "isArchived");

-- ── 2. Join requests ────────────────────────────────────────────────────────
-- status is TEXT, not an enum, for the reason recorded in
-- 2026-08-28-project-stage-pipelines.sql: a Postgres enum value can never be
-- dropped or renamed without rebuilding the type, which is the destructive
-- path this database forbids. Three values, checked in code.
--   PENDING | APPROVED | DECLINED
CREATE TABLE IF NOT EXISTS "TeamJoinRequest" (
  "id"         TEXT NOT NULL,
  "teamId"     TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "message"    TEXT,
  "decidedById" TEXT,
  "decidedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("id")
);

-- One live request per person per team. A decided request is kept for the
-- record, so the uniqueness is on the pair and the code updates the existing
-- row rather than inserting a second one.
CREATE UNIQUE INDEX IF NOT EXISTS "TeamJoinRequest_teamId_userId_key"
  ON "TeamJoinRequest" ("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamJoinRequest_teamId_status_idx"
  ON "TeamJoinRequest" ("teamId", "status");
CREATE INDEX IF NOT EXISTS "TeamJoinRequest_userId_idx"
  ON "TeamJoinRequest" ("userId");

-- Deleting a team takes its requests with it; deleting a user takes theirs.
-- decidedBy is SET NULL so removing the approver never erases the request.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamJoinRequest_teamId_fkey'
  ) THEN
    ALTER TABLE "TeamJoinRequest"
      ADD CONSTRAINT "TeamJoinRequest_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamJoinRequest_userId_fkey'
  ) THEN
    ALTER TABLE "TeamJoinRequest"
      ADD CONSTRAINT "TeamJoinRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TeamJoinRequest_decidedById_fkey'
  ) THEN
    ALTER TABLE "TeamJoinRequest"
      ADD CONSTRAINT "TeamJoinRequest_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
