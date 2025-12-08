-- Migration to rename syncInProgress (Boolean) to lock (String)
-- Values: "download" if true, null if false

-- Step 1: Add the new lock column as String (nullable)
ALTER TABLE "public"."SnapshotTable" ADD COLUMN "lock" TEXT;

-- Step 2: Migrate data - set "download" for true, null for false
UPDATE "public"."SnapshotTable" 
SET "lock" = CASE 
    WHEN "syncInProgress" = true THEN 'download'
    ELSE NULL
END;

-- Step 3: Drop the old syncInProgress column
ALTER TABLE "public"."SnapshotTable" DROP COLUMN "syncInProgress";
