/*
  Warnings:

  - Added the required column `connectorService` to the `SnapshotTable` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add the column as nullable first
ALTER TABLE "SnapshotTable" ADD COLUMN "connectorService" "Service";

-- Step 2: Populate connectorService from connectorAccount for existing rows
UPDATE "SnapshotTable" st
SET "connectorService" = ca.service
FROM "ConnectorAccount" ca
WHERE st."connectorAccountId" = ca.id;

-- Step 3: Set connectorService to CSV for rows with no connectorAccount
UPDATE "SnapshotTable"
SET "connectorService" = 'CSV'
WHERE "connectorAccountId" IS NULL;

-- Step 4: Make the column required (NOT NULL)
ALTER TABLE "SnapshotTable" ALTER COLUMN "connectorService" SET NOT NULL;
