/*
  Warnings:

  - The values [CUSTOM] on the enum `Service` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Service_new" AS ENUM ('NOTION', 'AIRTABLE', 'CSV', 'POSTGRES', 'YOUTUBE', 'WORDPRESS', 'WEBFLOW', 'WIX_BLOG');
ALTER TABLE "ConnectorAccount" ALTER COLUMN "service" TYPE "Service_new" USING ("service"::text::"Service_new");
ALTER TABLE "SnapshotTable" ALTER COLUMN "connectorService" TYPE "Service_new" USING ("connectorService"::text::"Service_new");
ALTER TYPE "Service" RENAME TO "Service_old";
ALTER TYPE "Service_new" RENAME TO "Service";
DROP TYPE "public"."Service_old";
COMMIT;
