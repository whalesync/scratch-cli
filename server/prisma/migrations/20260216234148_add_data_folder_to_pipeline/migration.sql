-- AlterTable
ALTER TABLE "PublishPipeline" ADD COLUMN     "dataFolderId" TEXT;

-- CreateIndex
CREATE INDEX "PublishPipeline_dataFolderId_idx" ON "PublishPipeline"("dataFolderId");

-- AddForeignKey
ALTER TABLE "PublishPipeline" ADD CONSTRAINT "PublishPipeline_dataFolderId_fkey" FOREIGN KEY ("dataFolderId") REFERENCES "DataFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
