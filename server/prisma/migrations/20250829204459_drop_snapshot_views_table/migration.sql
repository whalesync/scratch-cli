/*
  Warnings:

  - You are about to drop the `SnapshotTableView` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SnapshotTableView" DROP CONSTRAINT "SnapshotTableView_snapshotId_fkey";

-- DropTable
DROP TABLE "SnapshotTableView";
