-- Drop the foreign key constraint
ALTER TABLE "ConnectorAccount" DROP CONSTRAINT IF EXISTS "ConnectorAccount_organizationId_fkey";

-- Drop the index
DROP INDEX IF EXISTS "ConnectorAccount_organizationId_idx";

-- Drop the column
ALTER TABLE "ConnectorAccount" DROP COLUMN "organizationId";
