-- CreateTable
CREATE TABLE "AuditLogEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "context" JSONB,

    CONSTRAINT "AuditLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLogEvent_userId_idx" ON "AuditLogEvent"("userId");

-- CreateIndex
CREATE INDEX "AuditLogEvent_entityId_idx" ON "AuditLogEvent"("entityId");
