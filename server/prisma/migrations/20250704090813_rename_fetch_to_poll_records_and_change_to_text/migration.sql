/*
  Warnings:

  - You are about to drop the column `fetch` on the `GenericTable` table. All the data in the column will be lost.
  - Added the required column `pollRecords` to the `GenericTable` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GenericTable" DROP COLUMN "fetch",
ADD COLUMN     "pollRecords" TEXT NOT NULL;
