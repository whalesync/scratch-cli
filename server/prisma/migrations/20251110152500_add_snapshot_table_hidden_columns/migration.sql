-- AlterTable
ALTER TABLE "SnapshotTable" ADD COLUMN     "hiddenColumns" TEXT[] DEFAULT ARRAY[]::TEXT[];
