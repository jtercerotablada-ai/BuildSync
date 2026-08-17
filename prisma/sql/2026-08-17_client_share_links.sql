-- Additive-only DDL for the client share link feature.
--
-- Applied by hand with `prisma db execute` instead of `prisma db push`.
-- Reason: at this commit the production database has drifted AHEAD of
-- schema.prisma. `db push` computes a full convergence and would have run
--
--   ALTER TABLE "Project"         DROP COLUMN "archivedAt";
--   ALTER TABLE "Task"            DROP COLUMN "completedById", DROP COLUMN "dueAt";
--   ALTER TABLE "UserPreferences" DROP COLUMN "notifyDigestCadence";
--   DROP TYPE  "DigestCadence";
--   DROP INDEX "ProjectBrief_projectId_idx";
--
-- against live data. Dropping a column deletes that value from every row, so
-- this file applies only the three additions the feature actually needs and
-- leaves the pre-existing drift exactly as it was.
--
-- Every statement is additive and idempotent. No INSERT / UPDATE / DELETE.

-- Opt-in flag: is this document on the client link? Adding a NOT NULL column
-- WITH a default is a catalogue-only change on PostgreSQL 11+ (no rewrite).
ALTER TABLE "File"
  ADD COLUMN IF NOT EXISTS "sharedWithClient" BOOLEAN NOT NULL DEFAULT false;

-- The deliberate client-facing paraphrase of a status update. Nullable:
-- null means "show the client nothing", never "fall back to the internal text".
ALTER TABLE "StatusUpdate"
  ADD COLUMN IF NOT EXISTS "clientSummary" TEXT;

CREATE TABLE IF NOT EXISTS "ProjectShareLink" (
    "id"          TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "email"       TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "revokedAt"   TIMESTAMP(3),
    "lastSeenAt"  TIMESTAMP(3),
    "viewCount"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShareLink_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectShareLink_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectShareLink_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectShareLink_tokenHash_key"
  ON "ProjectShareLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "ProjectShareLink_projectId_idx"
  ON "ProjectShareLink"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectShareLink_tokenHash_idx"
  ON "ProjectShareLink"("tokenHash");
