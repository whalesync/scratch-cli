/*
  Warnings:

  - A unique constraint covering the columns `[onboardingWorkbookId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingWorkbookId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_onboardingWorkbookId_key" ON "User"("onboardingWorkbookId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_onboardingWorkbookId_fkey" FOREIGN KEY ("onboardingWorkbookId") REFERENCES "Workbook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
