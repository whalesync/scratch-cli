-- CreateEnum
CREATE TYPE "ConnectorHealthStatus" AS ENUM ('OK', 'FAILED');

-- AlterTable
ALTER TABLE "ConnectorAccount" ADD COLUMN     "healthStatus" "ConnectorHealthStatus",
ADD COLUMN     "healthStatusLastCheckedAt" TIMESTAMP(3);
