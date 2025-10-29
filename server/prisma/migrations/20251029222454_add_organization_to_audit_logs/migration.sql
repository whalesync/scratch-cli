-- AlterTable
ALTER TABLE "AuditLogEvent" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLogEvent_organizationId_idx" ON "AuditLogEvent"("organizationId");

-- AddForeignKey
ALTER TABLE "AuditLogEvent" ADD CONSTRAINT "AuditLogEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
