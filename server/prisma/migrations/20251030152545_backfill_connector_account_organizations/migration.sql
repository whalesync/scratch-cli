-- Backfill organizationId in ConnectorAccount records from their associated User records
UPDATE "ConnectorAccount" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "ConnectorAccount"."userId" = "User"."id" 
  AND "ConnectorAccount"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;