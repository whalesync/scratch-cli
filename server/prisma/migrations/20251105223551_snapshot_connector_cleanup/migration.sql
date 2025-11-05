/*
  Warnings:

  - You are about to drop the column `connectorAccountId` on the `Snapshot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Snapshot" DROP CONSTRAINT "Snapshot_connectorAccountId_fkey";

-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "connectorAccountId";
