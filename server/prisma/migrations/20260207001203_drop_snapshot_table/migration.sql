/*
  Warnings:

  - You are about to drop the `SnapshotTable` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SnapshotTable" DROP CONSTRAINT "SnapshotTable_connectorAccountId_fkey";

-- DropForeignKey
ALTER TABLE "SnapshotTable" DROP CONSTRAINT "SnapshotTable_folderId_fkey";

-- DropForeignKey
ALTER TABLE "SnapshotTable" DROP CONSTRAINT "SnapshotTable_workbookId_fkey";

-- DropTable
DROP TABLE "SnapshotTable";
