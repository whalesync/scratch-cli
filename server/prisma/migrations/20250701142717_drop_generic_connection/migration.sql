/*
  Warnings:

  - You are about to drop the column `genericConnectionId` on the `GenericTable` table. All the data in the column will be lost.
  - You are about to drop the `GenericConnection` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `GenericTable` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Service" ADD VALUE 'CUSTOM';

-- DropForeignKey
ALTER TABLE "GenericConnection" DROP CONSTRAINT "GenericConnection_userId_fkey";

-- DropForeignKey
ALTER TABLE "GenericTable" DROP CONSTRAINT "GenericTable_genericConnectionId_fkey";

-- DropIndex
DROP INDEX "GenericTable_genericConnectionId_idx";

-- AlterTable
ALTER TABLE "GenericTable" DROP COLUMN "genericConnectionId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- DropTable
DROP TABLE "GenericConnection";

-- CreateIndex
CREATE INDEX "GenericTable_userId_idx" ON "GenericTable"("userId");

-- AddForeignKey
ALTER TABLE "GenericTable" ADD CONSTRAINT "GenericTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
