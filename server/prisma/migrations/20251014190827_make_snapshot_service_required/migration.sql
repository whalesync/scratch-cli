-- Set default service for any snapshots with NULL service (legacy snapshots without connectors)
UPDATE "Snapshot"
SET "service" = 'CSV'
WHERE "service" IS NULL;

-- Make service column required (NOT NULL)
ALTER TABLE "Snapshot" ALTER COLUMN "service" SET NOT NULL;

