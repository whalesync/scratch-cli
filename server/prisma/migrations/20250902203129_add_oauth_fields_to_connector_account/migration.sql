-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('API_KEY', 'OAUTH');

-- AlterTable
ALTER TABLE "ConnectorAccount" ADD COLUMN     "authType" "AuthType" NOT NULL DEFAULT 'API_KEY',
ADD COLUMN     "oauthAccessToken" TEXT,
ADD COLUMN     "oauthExpiresAt" TIMESTAMP(3),
ADD COLUMN     "oauthRefreshToken" TEXT,
ADD COLUMN     "oauthWorkspaceId" TEXT;
