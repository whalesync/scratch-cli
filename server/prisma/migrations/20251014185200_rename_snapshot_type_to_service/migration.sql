-- Rename type column to service
ALTER TABLE "Snapshot" RENAME COLUMN "type" TO "service";

-- Update existing snapshots: copy service from connectorAccount
UPDATE "Snapshot" s
SET "service" = ca."service"
FROM "ConnectorAccount" ca
WHERE s."connectorAccountId" = ca."id"
  AND s."connectorAccountId" IS NOT NULL;

