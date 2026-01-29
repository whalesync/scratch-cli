/*
  Warnings:

  - You are about to drop the column `destinationDataFolderId` on the `Sync` table. All the data in the column will be lost.
  - You are about to drop the column `sourceDataFolderId` on the `Sync` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Sync" DROP CONSTRAINT "Sync_destinationDataFolderId_fkey";

-- DropForeignKey
ALTER TABLE "Sync" DROP CONSTRAINT "Sync_sourceDataFolderId_fkey";

-- AlterTable
ALTER TABLE "Sync" DROP COLUMN "destinationDataFolderId",
DROP COLUMN "sourceDataFolderId";

-- CreateTable
CREATE TABLE "SyncTablePair" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncId" TEXT NOT NULL,
    "sourceDataFolderId" TEXT NOT NULL,
    "destinationDataFolderId" TEXT NOT NULL,

    CONSTRAINT "SyncTablePair_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SyncTablePair" ADD CONSTRAINT "SyncTablePair_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "Sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncTablePair" ADD CONSTRAINT "SyncTablePair_sourceDataFolderId_fkey" FOREIGN KEY ("sourceDataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncTablePair" ADD CONSTRAINT "SyncTablePair_destinationDataFolderId_fkey" FOREIGN KEY ("destinationDataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
