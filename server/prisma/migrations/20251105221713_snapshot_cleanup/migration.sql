/*
  Warnings:

  - You are about to drop the column `columnContexts` on the `Snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `service` on the `Snapshot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Snapshot" DROP CONSTRAINT "Snapshot_connectorAccountId_fkey";

-- DropIndex
DROP INDEX "public"."Snapshot_connectorAccountId_idx";

-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "columnContexts",
DROP COLUMN "service";

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
