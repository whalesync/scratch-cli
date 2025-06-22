/*
  Warnings:

  - You are about to drop the `EditSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('CREATING', 'EDITING', 'COMMITTING', 'DONE', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "EditSession" DROP CONSTRAINT "EditSession_connectorAccountId_fkey";

-- DropTable
DROP TABLE "EditSession";

-- DropEnum
DROP TYPE "EditSessionStatus";

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'CREATING',
    "connectorAccountId" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_connectorAccountId_idx" ON "Snapshot"("connectorAccountId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_connectorAccountId_fkey" FOREIGN KEY ("connectorAccountId") REFERENCES "ConnectorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
