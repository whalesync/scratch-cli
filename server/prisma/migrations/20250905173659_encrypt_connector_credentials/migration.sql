/*
  Warnings:

  - You are about to drop the column `apiKey` on the `ConnectorAccount` table. All the data in the column will be lost.
  - You are about to drop the column `oauthAccessToken` on the `ConnectorAccount` table. All the data in the column will be lost.
  - You are about to drop the column `oauthExpiresAt` on the `ConnectorAccount` table. All the data in the column will be lost.
  - You are about to drop the column `oauthRefreshToken` on the `ConnectorAccount` table. All the data in the column will be lost.
  - You are about to drop the column `oauthWorkspaceId` on the `ConnectorAccount` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ConnectorAccount" DROP COLUMN "apiKey",
DROP COLUMN "oauthAccessToken",
DROP COLUMN "oauthExpiresAt",
DROP COLUMN "oauthRefreshToken",
DROP COLUMN "oauthWorkspaceId",
ADD COLUMN     "encryptedCredentials" JSONB NOT NULL DEFAULT '{}';
