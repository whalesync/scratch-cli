-- A data migration in order to drop the productType column from the Subscription table.
UPDATE "Subscription"
SET "planType" = "productType"
WHERE "planType" = 'NOT_MIGRATED' AND "productType" IS NOT NULL;
