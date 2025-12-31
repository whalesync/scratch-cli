-- Set the initial path for all tables to the table ID
UPDATE "SnapshotTable" SET path = '/' || id WHERE path IS NULL;