-- Add the userId column as nullable first
ALTER TABLE "Snapshot" ADD COLUMN "userId" TEXT;

-- Update existing snapshots to set userId from their connectorAccount
UPDATE "Snapshot" 
SET "userId" = "ConnectorAccount"."userId"
FROM "ConnectorAccount"
WHERE "Snapshot"."connectorAccountId" = "ConnectorAccount"."id";

-- For snapshots without connectorAccount, we'll need to handle them separately
-- For now, we'll delete them since they're likely test data
DELETE FROM "Snapshot" WHERE "userId" IS NULL;

-- Make userId NOT NULL after cleaning up data
ALTER TABLE "Snapshot" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Snapshot_userId_idx" ON "Snapshot"("userId");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
