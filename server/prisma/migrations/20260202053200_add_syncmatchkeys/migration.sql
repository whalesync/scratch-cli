/*
  Warnings:

  - You are about to drop the column `foreignKeyId` on the `SyncForeignKeyRecord` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[syncId,dataFolderId,foreignKeyColumnId,foreignKeyValue]` on the table `SyncForeignKeyRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `foreignKeyColumnId` to the `SyncForeignKeyRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foreignKeyValue` to the `SyncForeignKeyRecord` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "SyncForeignKeyRecord_syncId_dataFolderId_foreignKeyId_key";

-- AlterTable
ALTER TABLE "SyncForeignKeyRecord" DROP COLUMN "foreignKeyId",
ADD COLUMN     "foreignKeyColumnId" TEXT NOT NULL,
ADD COLUMN     "foreignKeyValue" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SyncMatchKeys" (
    "id" TEXT NOT NULL,
    "syncId" TEXT NOT NULL,
    "dataFolderId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,

    CONSTRAINT "SyncMatchKeys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncMatchKeys_syncId_matchId_idx" ON "SyncMatchKeys"("syncId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMatchKeys_syncId_dataFolderId_matchId_key" ON "SyncMatchKeys"("syncId", "dataFolderId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncForeignKeyRecord_syncId_dataFolderId_foreignKeyColumnId_key" ON "SyncForeignKeyRecord"("syncId", "dataFolderId", "foreignKeyColumnId", "foreignKeyValue");
