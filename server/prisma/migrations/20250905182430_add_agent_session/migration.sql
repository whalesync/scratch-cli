-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSession_sessionId_key" ON "AgentSession"("sessionId");

-- CreateIndex
CREATE INDEX "AgentSession_sessionId_idx" ON "AgentSession"("sessionId");
