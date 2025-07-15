-- CreateTable
CREATE TABLE "View" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT,
    "snapshotId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "View_snapshotId_idx" ON "View"("snapshotId");

-- CreateIndex
CREATE INDEX "View_parentId_idx" ON "View"("parentId");

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;
