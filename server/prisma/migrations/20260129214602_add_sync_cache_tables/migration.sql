-- CreateEnum
CREATE TYPE "SyncSide" AS ENUM ('SOURCE', 'DESTINATION');

-- CreateTable
CREATE TABLE "SyncForeignKeyRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncId" TEXT NOT NULL,
    "dataFolderId" TEXT NOT NULL,
    "side" "SyncSide" NOT NULL,
    "foreignKeyId" TEXT NOT NULL,
    "recordData" JSONB NOT NULL,

    CONSTRAINT "SyncForeignKeyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRemoteIdMapping" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncId" TEXT NOT NULL,
    "dataFolderId" TEXT NOT NULL,
    "sourceRemoteId" TEXT NOT NULL,
    "destinationRemoteId" TEXT NOT NULL,

    CONSTRAINT "SyncRemoteIdMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncForeignKeyRecord_syncId_idx" ON "SyncForeignKeyRecord"("syncId");

-- CreateIndex
CREATE INDEX "SyncForeignKeyRecord_dataFolderId_idx" ON "SyncForeignKeyRecord"("dataFolderId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncForeignKeyRecord_syncId_dataFolderId_foreignKeyId_key" ON "SyncForeignKeyRecord"("syncId", "dataFolderId", "foreignKeyId");

-- CreateIndex
CREATE INDEX "SyncRemoteIdMapping_syncId_idx" ON "SyncRemoteIdMapping"("syncId");

-- CreateIndex
CREATE INDEX "SyncRemoteIdMapping_dataFolderId_idx" ON "SyncRemoteIdMapping"("dataFolderId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRemoteIdMapping_syncId_dataFolderId_sourceRemoteId_key" ON "SyncRemoteIdMapping"("syncId", "dataFolderId", "sourceRemoteId");

-- AddForeignKey
ALTER TABLE "SyncForeignKeyRecord" ADD CONSTRAINT "SyncForeignKeyRecord_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "Sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncForeignKeyRecord" ADD CONSTRAINT "SyncForeignKeyRecord_dataFolderId_fkey" FOREIGN KEY ("dataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRemoteIdMapping" ADD CONSTRAINT "SyncRemoteIdMapping_syncId_fkey" FOREIGN KEY ("syncId") REFERENCES "Sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRemoteIdMapping" ADD CONSTRAINT "SyncRemoteIdMapping_dataFolderId_fkey" FOREIGN KEY ("dataFolderId") REFERENCES "DataFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
