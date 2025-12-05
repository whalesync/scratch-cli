-- AlterTable
ALTER TABLE "AiAgentTokenUsageEvent" ADD COLUMN     "credentialId" TEXT;

-- CreateIndex
CREATE INDEX "AiAgentTokenUsageEvent_credentialId_idx" ON "AiAgentTokenUsageEvent"("credentialId");
