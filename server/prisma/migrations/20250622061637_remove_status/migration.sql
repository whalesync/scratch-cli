/*
  Warnings:

  - You are about to drop the column `status` on the `Snapshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "status";

-- DropEnum
DROP TYPE "SnapshotStatus";
