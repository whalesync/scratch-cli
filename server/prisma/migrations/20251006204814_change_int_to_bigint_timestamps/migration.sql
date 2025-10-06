-- DropIndex
DROP INDEX "public"."Job_createdAt_idx";

-- AlterTable
ALTER TABLE "Job" ALTER COLUMN "processedOn" SET DATA TYPE BIGINT,
ALTER COLUMN "finishedOn" SET DATA TYPE BIGINT;

-- DropEnum
DROP TYPE "public"."JobStatus";
