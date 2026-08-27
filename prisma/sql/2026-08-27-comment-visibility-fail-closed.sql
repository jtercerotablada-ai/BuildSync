-- Comment.visibility: fail closed.
--
-- The column defaulted to EXTERNAL, and POST /api/tasks/:taskId/comments never
-- set it, so every internal note typed in the task panel was stored as
-- "publish this on the submitter's tracking page". No UI ever said so, and no
-- UI could set the flag either.
--
-- Two additive statements, no data loss:
--   1. flip the DEFAULT so a future write path that forgets the field fails
--      closed instead of open;
--   2. mark the existing panel-authored rows internal. Replies typed BY a
--      submitter on the tracking page (source = 'TRACKING_REPLY') are left
--      EXTERNAL — they are the submitter's own words on their own page.
--
-- Reversible with the same predicate. At the time of writing production holds
-- 16 affected rows and ZERO FormSubmission rows, so nothing is visible to
-- anyone today either way.
--
-- Run with:  npx prisma db execute --file prisma/sql/2026-08-27-comment-visibility-fail-closed.sql --schema prisma/schema.prisma
ALTER TABLE "Comment" ALTER COLUMN "visibility" SET DEFAULT 'INTERNAL_NOTE';

UPDATE "Comment"
SET "visibility" = 'INTERNAL_NOTE'
WHERE "source" <> 'TRACKING_REPLY'
  AND "visibility" = 'EXTERNAL';
