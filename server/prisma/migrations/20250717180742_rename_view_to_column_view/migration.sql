/*
  Warnings:

  - You are about to drop the `View` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "View" DROP CONSTRAINT "View_parentId_fkey";

-- DropTable
DROP TABLE "View";

-- CreateTable
CREATE TABLE "ColumnView" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "snapshotId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColumnView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ColumnView_snapshotId_idx" ON "ColumnView"("snapshotId");
