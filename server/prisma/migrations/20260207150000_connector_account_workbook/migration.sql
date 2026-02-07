-- Step 1: Add workbookId column (nullable initially)
ALTER TABLE "ConnectorAccount" ADD COLUMN "workbookId" TEXT;

-- Step 2: Create index
CREATE INDEX "ConnectorAccount_workbookId_idx" ON "ConnectorAccount"("workbookId");

-- Step 3: Add foreign key
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_workbookId_fkey"
  FOREIGN KEY ("workbookId") REFERENCES "Workbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 4: Create temp table to track old->new ID mapping
CREATE TEMP TABLE connector_migration_map (
  old_id TEXT NOT NULL,
  new_id TEXT NOT NULL,
  workbook_id TEXT NOT NULL,
  PRIMARY KEY (old_id, workbook_id)
);

-- Step 5: Generate new IDs and store mapping
-- ID format: 'coa_' + 10 alphanumeric chars (matches nanoid format)
-- Using md5 hash of random + timestamp for ID generation (no pgcrypto needed)
INSERT INTO connector_migration_map (old_id, new_id, workbook_id)
SELECT
  ca."id",
  'coa_' || substr(md5(random()::text || clock_timestamp()::text || ca."id"), 1, 10),
  df."workbookId"
FROM "ConnectorAccount" ca
JOIN (
  SELECT DISTINCT "connectorAccountId", "workbookId"
  FROM "DataFolder"
  WHERE "connectorAccountId" IS NOT NULL
) df ON df."connectorAccountId" = ca."id"
WHERE ca."workbookId" IS NULL;

-- Step 6: Create workbook-scoped copies using the mapping
INSERT INTO "ConnectorAccount" (
  "id", "createdAt", "updatedAt", "userId", "organizationId", "workbookId",
  "service", "displayName", "authType", "encryptedCredentials",
  "healthStatus", "healthStatusLastCheckedAt", "healthStatusMessage",
  "modifier", "extras"
)
SELECT
  m.new_id,
  NOW(),
  NOW(),
  ca."userId",
  ca."organizationId",
  m.workbook_id,
  ca."service",
  ca."displayName",
  ca."authType",
  ca."encryptedCredentials",
  ca."healthStatus",
  ca."healthStatusLastCheckedAt",
  ca."healthStatusMessage",
  ca."modifier",
  ca."extras"
FROM "ConnectorAccount" ca
JOIN connector_migration_map m ON m.old_id = ca."id";

-- Step 7: Update DataFolder references using the mapping
UPDATE "DataFolder" df
SET "connectorAccountId" = m.new_id
FROM connector_migration_map m
WHERE df."connectorAccountId" = m.old_id
  AND df."workbookId" = m.workbook_id;

-- Step 8: Delete orphaned and old org-level connections
DELETE FROM "ConnectorAccount" WHERE "workbookId" IS NULL;

-- Step 9: Make workbookId required
ALTER TABLE "ConnectorAccount" ALTER COLUMN "workbookId" SET NOT NULL;

-- Step 10: Drop temp table (optional, auto-dropped at end of transaction)
DROP TABLE IF EXISTS connector_migration_map;
