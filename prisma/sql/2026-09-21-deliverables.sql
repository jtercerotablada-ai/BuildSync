-- Deliverables: document control, RFIs, submittals, seal authority.
-- APPLIED BY HAND with prisma db execute. Production is AHEAD of schema.prisma;
-- `prisma db push` / `migrate` are forbidden (they would drop populated columns).
-- Every statement is additive and idempotent: running this file twice is a no-op.
--
-- ORDER: independent of every other prisma/sql file, including the
-- jurisdiction/client-contact 2026-09-21-*.sql written the same day. This file
-- creates four new tables and adds two nullable columns to "WorkspaceMember";
-- it touches no column of "Project". Either file may run first.
--
-- kind/docType/status/party/disposition/event type are TEXT, not enums, for the
-- reason given in 2026-08-28-project-stage-pipelines.sql: an enum value can never
-- be renamed or dropped without a destructive rebuild. Allowed values, labels
-- and holders live in src/lib/deliverables.ts.

ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "sealAuthorizedAt" TIMESTAMP(3);
ALTER TABLE "WorkspaceMember" ADD COLUMN IF NOT EXISTS "peLicenseNo" TEXT;

CREATE TABLE IF NOT EXISTS "Deliverable" (
  "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "docType" TEXT, "number" TEXT NOT NULL,
  "title" TEXT NOT NULL, "description" TEXT, "status" TEXT NOT NULL,
  "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3), "sealRequired" BOOLEAN NOT NULL DEFAULT true, "party" TEXT,
  "receivedAt" TIMESTAMP(3), "response" TEXT, "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "projectId" TEXT NOT NULL, "assigneeId" TEXT, "createdById" TEXT, "respondedById" TEXT,
  CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Deliverable_projectId_number_key" ON "Deliverable" ("projectId", "number");
CREATE INDEX IF NOT EXISTS "Deliverable_projectId_kind_status_idx" ON "Deliverable" ("projectId", "kind", "status");
CREATE INDEX IF NOT EXISTS "Deliverable_assigneeId_idx" ON "Deliverable" ("assigneeId");

CREATE TABLE IF NOT EXISTS "DeliverableRevision" (
  "id" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "label" TEXT NOT NULL, "notes" TEXT,
  "receivedAt" TIMESTAMP(3), "disposition" TEXT, "reviewedAt" TIMESTAMP(3),
  "sealedAt" TIMESTAMP(3), "sealedByName" TEXT, "sealLicenseNo" TEXT, "issuedAt" TIMESTAMP(3),
  "issuedToParty" TEXT, "issuedTo" TEXT, "transmittalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliverableId" TEXT NOT NULL, "createdById" TEXT, "sealedById" TEXT, "issuedById" TEXT, "reviewedById" TEXT,
  CONSTRAINT "DeliverableRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeliverableRevision_deliverableId_sequence_key" ON "DeliverableRevision" ("deliverableId", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliverableRevision_deliverableId_label_key" ON "DeliverableRevision" ("deliverableId", "label");

CREATE TABLE IF NOT EXISTS "DeliverableFile" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "url" TEXT NOT NULL, "size" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliverableId" TEXT NOT NULL, "revisionId" TEXT, "uploaderId" TEXT,
  CONSTRAINT "DeliverableFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliverableFile_deliverableId_idx" ON "DeliverableFile" ("deliverableId");
CREATE INDEX IF NOT EXISTS "DeliverableFile_revisionId_idx" ON "DeliverableFile" ("revisionId");

CREATE TABLE IF NOT EXISTS "DeliverableEvent" (
  "id" TEXT NOT NULL, "type" TEXT NOT NULL, "fromStatus" TEXT, "toStatus" TEXT,
  "note" TEXT, "actorName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliverableId" TEXT NOT NULL, "revisionId" TEXT, "actorId" TEXT,
  CONSTRAINT "DeliverableEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliverableEvent_deliverableId_createdAt_idx" ON "DeliverableEvent" ("deliverableId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Deliverable_projectId_fkey') THEN
    ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Deliverable_assigneeId_fkey') THEN
    ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Deliverable_createdById_fkey') THEN
    ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Deliverable_respondedById_fkey') THEN
    ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableRevision_deliverableId_fkey') THEN
    ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableRevision_createdById_fkey') THEN
    ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableRevision_sealedById_fkey') THEN
    ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_sealedById_fkey" FOREIGN KEY ("sealedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableRevision_issuedById_fkey') THEN
    ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableRevision_reviewedById_fkey') THEN
    ALTER TABLE "DeliverableRevision" ADD CONSTRAINT "DeliverableRevision_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableFile_deliverableId_fkey') THEN
    ALTER TABLE "DeliverableFile" ADD CONSTRAINT "DeliverableFile_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableFile_revisionId_fkey') THEN
    ALTER TABLE "DeliverableFile" ADD CONSTRAINT "DeliverableFile_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DeliverableRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableFile_uploaderId_fkey') THEN
    ALTER TABLE "DeliverableFile" ADD CONSTRAINT "DeliverableFile_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableEvent_deliverableId_fkey') THEN
    ALTER TABLE "DeliverableEvent" ADD CONSTRAINT "DeliverableEvent_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableEvent_revisionId_fkey') THEN
    ALTER TABLE "DeliverableEvent" ADD CONSTRAINT "DeliverableEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DeliverableRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DeliverableEvent_actorId_fkey') THEN
    ALTER TABLE "DeliverableEvent" ADD CONSTRAINT "DeliverableEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF;
END $$;
