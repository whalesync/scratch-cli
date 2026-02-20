-- DropIndex
DROP INDEX "PublishPlanEntry_planId_remoteTableId_idx";

-- AlterTable
ALTER TABLE "PublishPlanEntry" ADD COLUMN     "dataFolderId" TEXT;

-- CreateIndex
CREATE INDEX "PublishPlanEntry_planId_dataFolderId_idx" ON "PublishPlanEntry"("planId", "dataFolderId");
