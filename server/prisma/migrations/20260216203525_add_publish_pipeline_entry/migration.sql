-- CreateTable
CREATE TABLE "PublishPipeline" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workbookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "phases" JSONB NOT NULL,
    "result" JSONB,

    CONSTRAINT "PublishPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishPipelineEntry" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "editOperation" JSONB,
    "createOperation" JSONB,
    "deleteOperation" JSONB,
    "backfillOperation" JSONB,
    "editStatus" TEXT,
    "createStatus" TEXT,
    "deleteStatus" TEXT,
    "backfillStatus" TEXT,
    "hasEdit" BOOLEAN NOT NULL DEFAULT false,
    "hasCreate" BOOLEAN NOT NULL DEFAULT false,
    "hasDelete" BOOLEAN NOT NULL DEFAULT false,
    "hasBackfill" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishPipelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublishPipeline_workbookId_idx" ON "PublishPipeline"("workbookId");

-- CreateIndex
CREATE INDEX "PublishPipeline_userId_idx" ON "PublishPipeline"("userId");

-- CreateIndex
CREATE INDEX "PublishPipelineEntry_pipelineId_idx" ON "PublishPipelineEntry"("pipelineId");

-- CreateIndex
CREATE INDEX "PublishPipelineEntry_pipelineId_hasEdit_idx" ON "PublishPipelineEntry"("pipelineId", "hasEdit");

-- CreateIndex
CREATE INDEX "PublishPipelineEntry_pipelineId_hasCreate_idx" ON "PublishPipelineEntry"("pipelineId", "hasCreate");

-- CreateIndex
CREATE INDEX "PublishPipelineEntry_pipelineId_hasDelete_idx" ON "PublishPipelineEntry"("pipelineId", "hasDelete");

-- CreateIndex
CREATE INDEX "PublishPipelineEntry_pipelineId_hasBackfill_idx" ON "PublishPipelineEntry"("pipelineId", "hasBackfill");

-- CreateIndex
CREATE UNIQUE INDEX "PublishPipelineEntry_pipelineId_filePath_key" ON "PublishPipelineEntry"("pipelineId", "filePath");

-- AddForeignKey
ALTER TABLE "PublishPipeline" ADD CONSTRAINT "PublishPipeline_workbookId_fkey" FOREIGN KEY ("workbookId") REFERENCES "Workbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishPipeline" ADD CONSTRAINT "PublishPipeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishPipelineEntry" ADD CONSTRAINT "PublishPipelineEntry_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "PublishPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
