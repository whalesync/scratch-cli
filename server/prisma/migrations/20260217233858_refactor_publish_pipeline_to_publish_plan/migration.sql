/*
  Warnings:

  - You are about to drop the `PublishPipeline` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PublishPipelineEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PublishPipeline" DROP CONSTRAINT "PublishPipeline_connectorAccountId_fkey";

-- DropForeignKey
ALTER TABLE "PublishPipeline" DROP CONSTRAINT "PublishPipeline_userId_fkey";

-- DropForeignKey
ALTER TABLE "PublishPipeline" DROP CONSTRAINT "PublishPipeline_workbookId_fkey";

-- DropForeignKey
ALTER TABLE "PublishPipelineEntry" DROP CONSTRAINT "PublishPipelineEntry_pipelineId_fkey";

-- DropTable
DROP TABLE "PublishPipeline";

-- DropTable
DROP TABLE "PublishPipelineEntry";

-- CreateTable
CREATE TABLE "PublishPlan" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workbookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "phases" JSONB NOT NULL,
    "result" JSONB,
    "connectorAccountId" TEXT,

    CONSTRAINT "PublishPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishPlanEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "operation" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishPlanEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishPlan_workbookId_idx" ON "PublishPlan"("workbookId");

-- CreateIndex
CREATE INDEX "PublishPlan_userId_idx" ON "PublishPlan"("userId");

-- CreateIndex
CREATE INDEX "PublishPlan_connectorAccountId_idx" ON "PublishPlan"("connectorAccountId");

-- CreateIndex
CREATE INDEX "PublishPlanEntry_planId_idx" ON "PublishPlanEntry"("planId");

-- CreateIndex
CREATE INDEX "PublishPlanEntry_planId_phase_status_idx" ON "PublishPlanEntry"("planId", "phase", "status");

-- AddForeignKey
ALTER TABLE "PublishPlan" ADD CONSTRAINT "PublishPlan_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "Workbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishPlan" ADD CONSTRAINT "PublishPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishPlan" ADD CONSTRAINT "PublishPlan_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishPlanEntry" ADD CONSTRAINT "PublishPlanEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PublishPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
