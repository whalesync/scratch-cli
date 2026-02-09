-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "workbookId" TEXT;

-- CreateIndex
CREATE INDEX "Job_workbookId_idx" ON "Job"("workbookId");
