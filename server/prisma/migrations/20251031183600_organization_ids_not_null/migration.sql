/*
  This migration forces the switchover ownership of several core tables to Organization instead of User, making the user ID optional but the organization FK required.

  Warnings:

  - Made the column `organizationId` on table `ConnectorAccount` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `InvoiceResult` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `Snapshot` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `StyleGuide` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `Upload` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."AuditLogEvent" DROP CONSTRAINT "AuditLogEvent_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ConnectorAccount" DROP CONSTRAINT "ConnectorAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."InvoiceResult" DROP CONSTRAINT "InvoiceResult_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Snapshot" DROP CONSTRAINT "Snapshot_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StyleGuide" DROP CONSTRAINT "StyleGuide_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Upload" DROP CONSTRAINT "Upload_userId_fkey";

-- AlterTable
ALTER TABLE "AuditLogEvent" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ConnectorAccount" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceResult" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Snapshot" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "StyleGuide" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Upload" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleGuide" ADD CONSTRAINT "StyleGuide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceResult" ADD CONSTRAINT "InvoiceResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
