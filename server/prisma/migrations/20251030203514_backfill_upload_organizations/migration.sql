-- Backfill organizationId in Upload records from their associated User records
UPDATE "Upload" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "Upload"."userId" = "User"."id" 
  AND "Upload"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;