/*
  Warnings:

  - The `processedOn` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `finishedOn` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "processedOn",
ADD COLUMN     "processedOn" TIMESTAMP(3),
DROP COLUMN "finishedOn",
ADD COLUMN     "finishedOn" TIMESTAMP(3);
