-- CreateEnum
CREATE TYPE "AiAgentCredentialSource" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "AiAgentCredential" ADD COLUMN     "source" "AiAgentCredentialSource" NOT NULL DEFAULT 'USER';
