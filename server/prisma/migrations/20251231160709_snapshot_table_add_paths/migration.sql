-- AlterTable
ALTER TABLE "SnapshotTable" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "path" TEXT;

-- CreateIndex
CREATE INDEX "SnapshotTable_parentId_idx" ON "SnapshotTable"("parentId");

-- CreateIndex
CREATE INDEX "SnapshotTable_path_idx" ON "SnapshotTable"("path");

-- AddForeignKey
ALTER TABLE "SnapshotTable" ADD CONSTRAINT "SnapshotTable_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SnapshotTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
