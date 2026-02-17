/*
  Warnings:

  - You are about to drop the column `dataFolderId` on the `PublishPipeline` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PublishPipeline" DROP CONSTRAINT "PublishPipeline_dataFolderId_fkey";

-- DropIndex
DROP INDEX "PublishPipeline_dataFolderId_idx";

-- AlterTable
ALTER TABLE "PublishPipeline" DROP COLUMN "dataFolderId",
ADD COLUMN     "connectorAccountId" TEXT;

-- CreateIndex
CREATE INDEX "PublishPipeline_connectorAccountId_idx" ON "PublishPipeline"("connectorAccountId");

-- AddForeignKey
ALTER TABLE "PublishPipeline" ADD CONSTRAINT "PublishPipeline_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
