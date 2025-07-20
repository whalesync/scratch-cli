-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('AGENT', 'WEBSOCKET');

-- AlterTable
ALTER TABLE "APIToken" ADD COLUMN     "type" "TokenType" NOT NULL DEFAULT 'AGENT';
