-- Rename lock value from 'download' to 'pull'
UPDATE "SnapshotTable" SET lock = 'pull' WHERE lock = 'download';
UPDATE "DataFolder" SET lock = 'pull' WHERE lock = 'download';
