/*
  Warnings:

  - You are about to drop the column `tableContexts` on the `Snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `tableSpecs` on the `Snapshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "tableContexts",
DROP COLUMN "tableSpecs";
