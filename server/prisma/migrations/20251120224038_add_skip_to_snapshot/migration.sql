-- AlterTable: Add new currentSkip column
ALTER TABLE "SnapshotTable" ADD COLUMN "currentSkip" INTEGER DEFAULT 0;
