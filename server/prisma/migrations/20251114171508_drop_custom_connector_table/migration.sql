/*
  Warnings:

  - You are about to drop the `CustomConnector` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."CustomConnector" DROP CONSTRAINT "CustomConnector_userId_fkey";

-- DropTable
DROP TABLE "public"."CustomConnector";
