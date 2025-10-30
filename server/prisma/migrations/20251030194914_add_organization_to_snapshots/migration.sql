-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Snapshot_organizationId_idx" ON "Snapshot"("organizationId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
