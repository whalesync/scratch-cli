-- Drop the old unique constraint
DROP INDEX "SyncForeignKeyRecord_syncId_dataFolderId_foreignKeyColumnId_key";

-- Remove duplicates before adding the new unique constraint.
-- Keep one row per (syncId, dataFolderId, foreignKeyValue), preferring the earliest.
DELETE FROM "SyncForeignKeyRecord" a
  USING "SyncForeignKeyRecord" b
  WHERE a."syncId" = b."syncId"
    AND a."dataFolderId" = b."dataFolderId"
    AND a."foreignKeyValue" = b."foreignKeyValue"
    AND a."id" > b."id";

-- Drop columns
ALTER TABLE "SyncForeignKeyRecord" DROP COLUMN "side";
ALTER TABLE "SyncForeignKeyRecord" DROP COLUMN "foreignKeyColumnId";

-- Add new unique constraint
CREATE UNIQUE INDEX "SyncForeignKeyRecord_syncId_dataFolderId_foreignKeyValue_key" ON "SyncForeignKeyRecord"("syncId", "dataFolderId", "foreignKeyValue");

-- Drop the enum (no longer used anywhere)
DROP TYPE "SyncSide";
