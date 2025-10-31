-- Backfill organizationId in Subscription records from their associated User records
UPDATE "Subscription" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "Subscription"."userId" = "User"."id" 
  AND "Subscription"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;

-- Backfill organizationId in InvoiceResult records from their associated User records
UPDATE "InvoiceResult" 
SET "organizationId" = "User"."organizationId"
FROM "User"
WHERE "InvoiceResult"."userId" = "User"."id" 
  AND "InvoiceResult"."organizationId" IS NULL
  AND "User"."organizationId" IS NOT NULL;
