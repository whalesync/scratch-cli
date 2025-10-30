-- Backfill organizationId in StyleGuide records from their associated User records
UPDATE "StyleGuide" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "StyleGuide"."userId" = "User"."id" 
  AND "StyleGuide"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;