-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "columnContexts" JSONB NOT NULL DEFAULT '{}';
