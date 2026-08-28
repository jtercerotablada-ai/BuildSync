-- Per-type project stage pipelines.
--
-- Production is AHEAD of schema.prisma, so `prisma db push` / `migrate` are
-- forbidden here — they would drop populated columns. Everything below is
-- additive and was applied by hand with prisma db execute, step by step.
--
-- WHY A TEXT COLUMN AND NOT MORE ProjectGate VALUES: four pipelines need ~30
-- stage values, and a Postgres enum value can never be removed or renamed
-- without rebuilding the type — the exact destructive path this database
-- forbids. One label the firm dislikes would be permanent. Enum declaration
-- order is also fixed at insert time, and with four pipelines there is no
-- single correct order, so ORDER BY would be meaningless anyway. Labels,
-- order and holders live in src/lib/pipelines.ts instead: renaming or
-- reordering a stage becomes a deploy with no SQL at all.
--
-- The legacy `gate` column is KEPT and still written, derived from the stage,
-- so the readouts that have not been migrated yet keep rendering.

-- STEP 1 — run ALONE, before anything else. A newly added enum value cannot be
-- used by other statements until its transaction commits.
-- IRREVERSIBLE: an enum value cannot be dropped.
ALTER TYPE "ProjectType" ADD VALUE IF NOT EXISTS 'BSIP';

-- STEP 2 — the stage itself.
-- stageEnteredAt powers "days on someone's desk", which is the whole point of
-- naming the holder. stageBlocker is the one line saying what we are actually
-- waiting on, so a stage does not need a variant per reason.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "stage" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "stageEnteredAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "stageBlocker" TEXT;
CREATE INDEX IF NOT EXISTS "Project_stage_idx" ON "Project"("stage");

-- STEP 3 — stage history.
-- Required, not optional: Activity is task-scoped (it has a taskId), so there
-- is nowhere else to record a project-level move. Every number worth showing
-- comes from this table — days in stage, how many times a job went back through
-- City Comments, how long the last three sat on a client's desk.
CREATE TABLE IF NOT EXISTS "ProjectStageEvent" (
  "id"        TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "fromStage" TEXT,
  "toStage"   TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'FORWARD',
  "reason"    TEXT,
  "userId"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectStageEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectStageEvent"
  DROP CONSTRAINT IF EXISTS "ProjectStageEvent_projectId_fkey";
ALTER TABLE "ProjectStageEvent"
  ADD CONSTRAINT "ProjectStageEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectStageEvent"
  DROP CONSTRAINT IF EXISTS "ProjectStageEvent_userId_fkey";
ALTER TABLE "ProjectStageEvent"
  ADD CONSTRAINT "ProjectStageEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ProjectStageEvent_projectId_createdAt_idx"
  ON "ProjectStageEvent"("projectId", "createdAt");

-- STEP 4 — backfill.
-- Every existing project reads gate = PRE_DESIGN, but that is the column's
-- DEFAULT, not a statement about the work: nobody could ever set it, because
-- no screen sent a gate. So it carries no information to migrate, and seeding
-- each job at its pipeline's first stage is the only honest answer. The firm
-- corrects six rows by hand.
UPDATE "Project" SET "stage" = 'recert.draft'
  WHERE "stage" IS NULL AND "type" IN ('RECERTIFICATION', 'BSIP');
UPDATE "Project" SET "stage" = 'design.draft'
  WHERE "stage" IS NULL AND "type" = 'DESIGN';
UPDATE "Project" SET "stage" = 'permit.preparing_submittal'
  WHERE "stage" IS NULL AND "type" = 'PERMIT';
UPDATE "Project" SET "stage" = 'construction.draft'
  WHERE "stage" IS NULL AND "type" = 'CONSTRUCTION';
-- type IS NULL is left with stage NULL on purpose: the strip renders
-- "Set stage" rather than guessing a pipeline for a job with no type.
