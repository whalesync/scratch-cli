-- AlterTable
ALTER TABLE "InvoiceResult" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "InvoiceResult_userId_idx" ON "InvoiceResult"("userId");

-- CreateIndex
CREATE INDEX "InvoiceResult_organizationId_idx" ON "InvoiceResult"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceResult_invoiceId_idx" ON "InvoiceResult"("invoiceId");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceResult" ADD CONSTRAINT "InvoiceResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
