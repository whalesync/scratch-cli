-- Backfill organizationId in Snapshot records from their associated User records
UPDATE "Snapshot" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "Snapshot"."userId" = "User"."id" 
  AND "Snapshot"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;