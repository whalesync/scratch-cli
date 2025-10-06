-- Add progress column
ALTER TABLE "Job" ADD COLUMN "progress" JSONB;

-- Create a temporary column with the new type
ALTER TABLE "Job" ADD COLUMN "status_new" TEXT;

-- Copy data from old status column to new one, converting enum values to strings
UPDATE "Job" SET "status_new" = "status"::TEXT;

-- Drop the old status column
ALTER TABLE "Job" DROP COLUMN "status";

-- Rename the new column to status
ALTER TABLE "Job" RENAME COLUMN "status_new" TO "status";

-- Make status NOT NULL
ALTER TABLE "Job" ALTER COLUMN "status" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");
