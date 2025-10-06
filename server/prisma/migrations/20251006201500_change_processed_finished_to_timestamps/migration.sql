-- Add new integer timestamp columns
ALTER TABLE "Job" ADD COLUMN "processedOn" INTEGER;
ALTER TABLE "Job" ADD COLUMN "finishedOn" INTEGER;

-- Convert existing DateTime columns to timestamps (seconds since epoch)
UPDATE "Job" SET "processedOn" = EXTRACT(EPOCH FROM "startedAt")::INTEGER WHERE "startedAt" IS NOT NULL;
UPDATE "Job" SET "finishedOn" = EXTRACT(EPOCH FROM "completedAt")::INTEGER WHERE "completedAt" IS NOT NULL;

-- Drop the old DateTime columns
ALTER TABLE "Job" DROP COLUMN "startedAt";
ALTER TABLE "Job" DROP COLUMN "completedAt";
