/*
  Warnings:

  - The primary key for the `APIToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[token]` on the table `APIToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id` to the `APIToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "APIToken" DROP CONSTRAINT "APIToken_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "APIToken_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "APIToken_token_key" ON "APIToken"("token");
