/*
  Warnings:

  - The primary key for the `APIToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "APIToken" DROP CONSTRAINT "APIToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "ConnectorAccount" DROP CONSTRAINT "ConnectorAccount_userId_fkey";

-- AlterTable
ALTER TABLE "APIToken" DROP CONSTRAINT "APIToken_pkey",
ALTER COLUMN "token" DROP DEFAULT,
ALTER COLUMN "token" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "APIToken_pkey" PRIMARY KEY ("token");

-- AlterTable
ALTER TABLE "ConnectorAccount" ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "APIToken" ADD CONSTRAINT "APIToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectorAccount" ADD CONSTRAINT "ConnectorAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
