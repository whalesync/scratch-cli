-- Rename the Snapshot table to Workbook
ALTER TABLE "public"."Snapshot" RENAME TO "Workbook";

-- Rename the primary key constraint
ALTER TABLE "public"."Workbook" RENAME CONSTRAINT "Snapshot_pkey" TO "Workbook_pkey";

-- Rename the foreign key constraints on the Workbook table
ALTER TABLE "public"."Workbook" RENAME CONSTRAINT "Snapshot_userId_fkey" TO "Workbook_userId_fkey";
ALTER TABLE "public"."Workbook" RENAME CONSTRAINT "Snapshot_organizationId_fkey" TO "Workbook_organizationId_fkey";

-- Rename indexes on the Workbook table
ALTER INDEX "public"."Snapshot_userId_idx" RENAME TO "Workbook_userId_idx";
ALTER INDEX "public"."Snapshot_organizationId_idx" RENAME TO "Workbook_organizationId_idx";

-- Rename snapshotId column to workbookId in AgentSession
ALTER TABLE "public"."AgentSession" RENAME COLUMN "snapshotId" TO "workbookId";

-- Rename indexes on AgentSession
ALTER INDEX "public"."AgentSession_snapshotId_idx" RENAME TO "AgentSession_workbookId_idx";
ALTER INDEX "public"."AgentSession_userId_snapshotId_idx" RENAME TO "AgentSession_userId_workbookId_idx";

-- Rename snapshotId column to workbookId in SnapshotTable
ALTER TABLE "public"."SnapshotTable" RENAME COLUMN "snapshotId" TO "workbookId";

-- Rename the foreign key constraint on SnapshotTable
ALTER TABLE "public"."SnapshotTable" DROP CONSTRAINT "SnapshotTable_snapshotId_fkey";
ALTER TABLE "public"."SnapshotTable" ADD CONSTRAINT "SnapshotTable_workbookId_fkey" 
    FOREIGN KEY ("workbookId") REFERENCES "Workbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename index on SnapshotTable
ALTER INDEX "public"."SnapshotTable_snapshotId_idx" RENAME TO "SnapshotTable_workbookId_idx";