-- Jurisdiction, reference numbers, regulatory deadline and client contact on Project.
-- OWNER of these 8 columns + index. The Home Cockpit feature depends on this file; it must not add them again.
-- Production is AHEAD of schema.prisma: `prisma db push` / `migrate` are forbidden (they would drop populated
-- columns). Additive and idempotent; apply with:
--   npx prisma db execute --file prisma/sql/2026-09-21-project-jurisdiction.sql --schema prisma/schema.prisma
-- WHY TEXT AND NOT ENUMS: the AHJ list, the kinds of reference numbers and what "the deadline" means per project
-- type are product decisions that will change; a Postgres enum value can never be renamed or dropped without
-- rebuilding the type. Validation lives in src/lib/regulatory-schema.ts.
-- No backfill: the firm workspace has zero projects and every column is nullable.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "folioNumber" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "permitNumber" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "caseNumber" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "regulatoryDeadline" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientContactName" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientContactEmail" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "clientContactPhone" TEXT;
-- The daily cron and the cockpit's deadline panel range-scan this column.
CREATE INDEX IF NOT EXISTS "Project_regulatoryDeadline_idx" ON "Project"("regulatoryDeadline");
