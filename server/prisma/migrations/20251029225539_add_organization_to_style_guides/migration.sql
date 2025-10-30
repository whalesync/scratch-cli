-- AlterTable
ALTER TABLE "StyleGuide" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "StyleGuide_organizationId_idx" ON "StyleGuide"("organizationId");

-- AddForeignKey
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
