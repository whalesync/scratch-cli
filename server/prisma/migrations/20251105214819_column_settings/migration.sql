ALTER TABLE "SnapshotTable" DROP COLUMN "columnContexts",
ADD COLUMN     "columnSettings" JSONB NOT NULL DEFAULT '{}';
