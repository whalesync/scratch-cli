/*
  Warnings:

  - You are about to drop the column `sessionId` on the `AgentSession` table. All the data in the column will be lost.
  - Added the required column `snapshotId` to the `AgentSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `AgentSession` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AgentSession_sessionId_idx";

-- DropIndex
DROP INDEX "AgentSession_sessionId_key";

-- AlterTable
ALTER TABLE "AgentSession" DROP COLUMN "sessionId",
ADD COLUMN     "snapshotId" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AgentSession_userId_idx" ON "AgentSession"("userId");

-- CreateIndex
CREATE INDEX "AgentSession_snapshotId_idx" ON "AgentSession"("snapshotId");

-- CreateIndex
CREATE INDEX "AgentSession_userId_snapshotId_idx" ON "AgentSession"("userId", "snapshotId");
