-- CreateEnum
CREATE TYPE "RecordDeleteBehavior" AS ENUM ('DELETE', 'IGNORE');

-- CreateEnum
CREATE TYPE "SyncState" AS ENUM ('OFF', 'ON');

-- CreateTable
CREATE TABLE "Sync" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayOrder" SMALLINT NOT NULL DEFAULT 0,
    "sourceDataFolderId" TEXT NOT NULL,
    "destinationDataFolderId" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "syncState" "SyncState" NOT NULL DEFAULT 'OFF',
    "syncStateLastChanged" TIMESTAMP(3),
    "lastSyncTime" TIMESTAMP(3),

    CONSTRAINT "Sync_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_sourceDataFolderId_fkey" FOREIGN KEY ("sourceDataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sync" ADD CONSTRAINT "Sync_destinationDataFolderId_fkey" FOREIGN KEY ("destinationDataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
