-- AlterTable
ALTER TABLE "PublishPlanEntry" ADD COLUMN     "remoteTableId" TEXT;

-- CreateIndex
CREATE INDEX "PublishPlanEntry_planId_remoteTableId_idx" ON "PublishPlanEntry"("planId", "remoteTableId");
