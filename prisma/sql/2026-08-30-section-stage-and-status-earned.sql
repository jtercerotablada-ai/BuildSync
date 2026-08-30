-- One vocabulary for "where is this job", and a status that has to be earned.
--
-- WHY. A recertification screen showed the owner three different answers to
-- what he read as one question: a health status (On track / At risk), an
-- 11-stage pipeline that names WHOSE DESK the job sits on, and a board whose
-- columns (Kickoff & scheduling -> Inspection & Reports -> Building Official
-- Review -> Repairs -> Recertification Complete) are a coarser copy of that
-- same pipeline. The stages were added after the template's sections and the
-- two were never reconciled. He said, correctly, that it did not inspire
-- confidence.
--
-- WHAT THIS ENABLES, and what it deliberately does NOT do:
--   * Section.stage lets a board column declare which pipeline stage its work
--     belongs to, so the board and the strip speak one vocabulary and the
--     product can tell when a stage's work is finished.
--   * It does NOT make the stage derived. Several recert stages are pure
--     waiting on somebody else — awaiting_client_repairs, awaiting_client_fees,
--     reinspection — and carry no column at all on the firm's templates.
--     "The furthest column with open work" could never land on one of them,
--     so deriving the stage would silently skip exactly the stages where
--     "whose desk is this on?" is the whole question, and would throw away
--     stageEnteredAt ("The client · 24 days"), stageBlocker and the
--     ProjectStageEvent history. The stage stays stored and human-moved; the
--     product only OFFERS the next move once the current stage has no open
--     work left.
--
--   * Project.statusSetAt records that a human actually chose the status.
--     ProjectStatus defaults to ON_TRACK, so every project has always claimed
--     to be fine from the moment it was created, whether or not anyone looked.
--     A null here means nobody ever said so, and the UI shows "No status"
--     rather than an unearned green. Recorded as a timestamp rather than by
--     making status nullable: that keeps every existing value intact and needs
--     no enum surgery, which this database forbids.
--
-- APPLIED BY HAND with `prisma db execute`. Production is AHEAD of
-- schema.prisma and `prisma db push` would DROP populated columns. Every
-- statement here is additive and idempotent.

-- ── 1. A board column can name the stage its work belongs to ───────────────
-- TEXT, matching Project.stage, for the reason recorded in
-- 2026-08-28-project-stage-pipelines.sql: a Postgres enum value can never be
-- dropped or renamed without rebuilding the type. NULL = a free-form column
-- that maps to no stage, which stays perfectly valid.
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "stage" TEXT;

-- Finding "the section for the project's current stage" is the hot read.
CREATE INDEX IF NOT EXISTS "Section_projectId_stage_idx"
  ON "Section" ("projectId", "stage");

-- ── 2. A status has to be earned ───────────────────────────────────────────
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "statusSetAt" TIMESTAMP(3);

-- Deliberately NOT backfilled. Every existing project keeps its stored status
-- value, and every one of them reads as "No status" until somebody sets it —
-- which is the honest answer, because none of them was ever set by a human.
