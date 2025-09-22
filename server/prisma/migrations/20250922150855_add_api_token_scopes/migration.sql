-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "APIToken" ADD COLUMN     "scopes" TEXT[];
