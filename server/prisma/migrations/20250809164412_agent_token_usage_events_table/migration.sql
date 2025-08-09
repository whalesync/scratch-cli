-- CreateTable
CREATE TABLE "AiAgentTokenUsageEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requests" INTEGER NOT NULL,
    "requestTokens" INTEGER NOT NULL,
    "responseTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "context" JSONB,

    CONSTRAINT "AiAgentTokenUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAgentTokenUsageEvent_userId_idx" ON "AiAgentTokenUsageEvent"("userId");

-- AddForeignKey
ALTER TABLE "AiAgentTokenUsageEvent" ADD CONSTRAINT "AiAgentTokenUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
