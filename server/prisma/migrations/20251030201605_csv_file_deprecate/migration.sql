/*
  Warnings:

  - You are about to drop the `CsvFile` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."CsvFile" DROP CONSTRAINT "CsvFile_userId_fkey";

-- DropTable
DROP TABLE "public"."CsvFile";
