-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "dataFolderId" TEXT;

-- CreateIndex
CREATE INDEX "Job_dataFolderId_idx" ON "Job"("dataFolderId");
