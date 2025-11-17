-- AlterTable
ALTER TABLE "SnapshotTable" ADD COLUMN     "tableName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "version" TEXT NOT NULL DEFAULT 'v0';

-- Backfill tableName from tableSpec.id.wsId for existing records (v0 format)
UPDATE "SnapshotTable"
SET "tableName" = COALESCE(
  "tableSpec"::jsonb->'id'->>'wsId',
  ''
)
WHERE "tableName" = '';

-- CreateIndex
CREATE INDEX "SnapshotTable_version_idx" ON "SnapshotTable"("version");
