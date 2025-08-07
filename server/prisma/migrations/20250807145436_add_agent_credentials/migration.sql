-- CreateTable
CREATE TABLE "AiAgentCredential" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "AiAgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAgentCredential_userId_idx" ON "AiAgentCredential"("userId");

-- AddForeignKey
ALTER TABLE "AiAgentCredential" ADD CONSTRAINT "AiAgentCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
