/*
  Warnings:

  - You are about to drop the column `parentId` on the `SnapshotTable` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "SnapshotTable" DROP CONSTRAINT "SnapshotTable_parentId_fkey";

-- DropIndex
DROP INDEX "SnapshotTable_parentId_idx";

-- AlterTable
ALTER TABLE "SnapshotTable" DROP COLUMN "parentId";
