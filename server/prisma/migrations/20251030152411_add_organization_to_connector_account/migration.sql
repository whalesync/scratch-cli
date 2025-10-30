-- AlterTable
ALTER TABLE "ConnectorAccount" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "ConnectorAccount_userId_idx" ON "ConnectorAccount"("userId");

-- CreateIndex
CREATE INDEX "ConnectorAccount_organizationId_idx" ON "ConnectorAccount"("organizationId");

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
